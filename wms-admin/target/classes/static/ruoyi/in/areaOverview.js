var areaPathfindingService = typeof PathfindingService !== 'undefined' ? new PathfindingService() : null;

new Vue({
    el: '#area-overview',
    data: {
        areas: [],
        selectedAreaIds: [],
        pathData: null,
        routeOrder: [],
        entrancePosition: null,
        gridDimensions: {
            gridRows: 0,
            gridCols: 0
        },
        boardMetrics: {
            layoutRows: 0,
            layoutCols: 0,
            gridRows: 0,
            gridCols: 0
        },
        displayCells: [],
        style: [],  // 样式数组，控制每个格子的大小和位置
        tooltip: {
            visible: false,
            title: '',
            subtitle: '',
            extra: '',
            style: {}
        },
        contextMenu: {
            visible: false,
            title: '',
            items: [],
            style: {}
        },
        cacheKey: 'wms/areaRoutePlan',
        gridSettings: {
            columns: 12,
            minRows: 4
        },
        pathSimulation: {
            running: false,
            paused: false,
            currentIndex: -1,
            timerId: null,
            intervalMs: 2500,
            completed: false,
            stoppedManually: false
        },
        simulationStates: {},
        pathVisualizer: null,
        resizeHandler: null,
        animatePathProgress: 0,
        animatePathLastTime: null,
        animatePathFrameId: null,
        areaStats: {
            empty: 0,
            occupied: 0
        }
    },
    computed: {
        orderedAreas() {
            if (!this.routeOrder || this.routeOrder.length === 0) {
                return [];
            }
            const ordered = [];
            this.routeOrder.forEach(id => {
                const area = this.areas.find(item => item.areaId === id);
                if (area) {
                    ordered.push(area);
                }
            });
            return ordered;
        },
        canStartSimulation() {
            return !!(this.pathData && Array.isArray(this.routeOrder) && this.routeOrder.length > 0);
        },
        canTogglePause() {
            if (!this.canStartSimulation) {
                return false;
            }
            return this.pathSimulation.running || this.pathSimulation.paused;
        },
        canStopSimulation() {
            if (!this.canStartSimulation) {
                return false;
            }
            return this.pathSimulation.running || this.pathSimulation.paused || this.pathSimulation.currentIndex >= 0;
        },
        pathStatusText() {
            if (!this.pathData || !this.routeOrder || this.routeOrder.length === 0) {
                return '尚未生成路径';
            }
            if (this.pathSimulation.running && !this.pathSimulation.paused) {
                return '路径模拟中';
            }
            if (this.pathSimulation.paused) {
                return '模拟已暂停';
            }
            if (this.pathSimulation.completed) {
                return '模拟完成';
            }
            if (this.pathSimulation.stoppedManually) {
                return '模拟已停止';
            }
            return '路径已生成，可开始模拟';
        },
        entranceStyle() {
            if (!this.entrancePosition || !this.boardMetrics.gridCols || !this.boardMetrics.gridRows) {
                return {
                    left: '50%',
                    top: '-28px'
                };
            }
            const colDenominator = Math.max(this.boardMetrics.gridCols - 1, 1);
            const rowDenominator = Math.max(this.boardMetrics.gridRows - 1, 1);
            const leftPercent = (this.entrancePosition.col / colDenominator) * 100;
            const topPercent = (this.entrancePosition.row / rowDenominator) * 100;
            return {
                left: `calc(${leftPercent}% - 24px)`,
                top: `calc(${topPercent}% - 32px)`
            };
        }
    },
    created() {
        this.restoreFromCache();
        this.fetchAreas();
    },
    mounted() {
        this.resizeHandler = this.handleResize.bind(this);
        window.addEventListener('resize', this.resizeHandler);
        this.initPathVisualizer();
        this.$nextTick(() => this.updatePathVisualization());
        document.addEventListener('click', this.hideContextMenu.bind(this));
    },
    methods: {
        fetchAreas() {
            var that = this;
            $.ajax({
                cache: false,
                type: 'POST',
                url: '/system/areaInfo/list',
                data: {
                    pageNum: 1,
                    pageSize: 999
                },
                success(data) {
                    console.log('货区数据响应:', data);
                    that.areas = data && data.rows ? data.rows : [];
                    
                    // 获取每个货区下的货架数量，并根据货架数量设置状态
                    let pendingRequests = that.areas.length;
                    if (pendingRequests === 0) {
                        that.reconcileSelections();
                        that.rebuildBoardLayout();
                        that.updateAreaStats();
                        return;
                    }
                    
                    that.areas.forEach((area, index) => {
                        $.ajax({
                            cache: true,
                            type: 'POST',
                            url: '/system/shelfInfo/listByArea',
                            data: {
                                areaId: area.areaId
                            },
                            success(shelfData) {
                                const shelves = shelfData || [];
                                // 根据货架数量判断状态：有货架为使用中(1)，无货架为空闲(0)
                                that.areas[index].status = shelves.length > 0 ? 1 : 0;
                                that.areas[index].shelfCount = shelves.length;
                                
                                pendingRequests--;
                                if (pendingRequests === 0) {
                                    console.log('解析后的货区列表:', that.areas);
                                    that.reconcileSelections();
                                    that.rebuildBoardLayout();
                                    that.updateAreaStats();
                                }
                            },
                            error() {
                                // 如果获取货架失败，默认为空闲状态
                                that.areas[index].status = 0;
                                that.areas[index].shelfCount = 0;
                                
                                pendingRequests--;
                                if (pendingRequests === 0) {
                                    console.log('解析后的货区列表:', that.areas);
                                    that.reconcileSelections();
                                    that.rebuildBoardLayout();
                                    that.updateAreaStats();
                                }
                            }
                        });
                    });
                },
                error(xhr, status, error) {
                    console.error('货区数据加载失败:', status, error, xhr);
                    $.modal.alertError('货区数据加载失败: ' + error);
                }
            });
        },
        reconcileSelections() {
            if (!this.areas || this.areas.length === 0) {
                this.selectedAreaIds = [];
                this.routeOrder = [];
                this.persistState();
                return;
            }
            const availableIds = this.areas.map(item => item.areaId);
            this.selectedAreaIds = this.selectedAreaIds.filter(id => availableIds.indexOf(id) > -1);
            this.routeOrder = this.routeOrder.filter(id => availableIds.indexOf(id) > -1);
            this.persistState();
        },
        handleGridSettingsChange() {
            // 验证输入值的有效性
            if (this.gridSettings.columns < 1) {
                this.gridSettings.columns = 1;
            }
            if (this.gridSettings.columns > 50) {
                this.gridSettings.columns = 50;
            }
            if (this.gridSettings.minRows < 1) {
                this.gridSettings.minRows = 1;
            }
            if (this.gridSettings.minRows > 50) {
                this.gridSettings.minRows = 50;
            }
            // 保存是否有之前的路径结果
            const hadPath = !!this.pathData;
            // 重新构建布局，这会更新 boardMetrics 和 gridDimensions
            // 这会重新计算每个货区在网格中的位置（gridRow, gridCol）
            this.rebuildBoardLayout();
            // 清除之前的路径结果，因为布局已改变，路径需要重新计算
            this.clearPathResults(false);
            // 更新路径可视化（如果有的话）
            this.$nextTick(() => {
                this.updatePathVisualization();
                // 如果之前有路径结果，提示用户需要重新计算路径
                if (hadPath && this.selectedAreaIds.length > 0) {
                    $.modal.msg('布局已更新，请重新计算路径');
                }
            });
        },
        rebuildBoardLayout() {
            if (!this.areas || this.areas.length === 0) {
                this.displayCells = [];
                this.style = [];
                this.boardMetrics = {
                    layoutRows: 0,
                    layoutCols: 0,
                    gridRows: 0,
                    gridCols: 0
                };
                this.gridDimensions = {
                    gridRows: 0,
                    gridCols: 0
                };
                this.entrancePosition = null;
                this.clearPathVisualization();
                return;
            }
            
            // 使用用户设置的值，如果没有设置或无效则使用自动计算的值
            const autoPerRow = Math.ceil(Math.sqrt(this.areas.length));
            const perRow = this.gridSettings.columns && this.gridSettings.columns > 0 
                ? Math.max(1, this.gridSettings.columns) 
                : Math.max(1, autoPerRow);
            const autoRows = Math.ceil(this.areas.length / perRow);
            const rows = this.gridSettings.minRows && this.gridSettings.minRows > 0
                ? Math.max(autoRows, this.gridSettings.minRows)
                : autoRows;
            const totalSlots = rows * perRow;
            
            // 计算格子的宽度百分比
            const widthPercent = 100 / perRow;
            
            // 构建显示单元格数组
            const cells = [];
            const styles = [];
            
            for (let i = 0; i < totalSlots; i++) {
                const area = this.areas[i] || null;
                const layoutRow = Math.floor(i / perRow);
                const layoutCol = i % perRow;
                
                cells.push({
                    key: area ? 'area-' + area.areaId : 'placeholder-' + i,
                    area: area,
                    layoutRow: layoutRow,
                    layoutCol: layoutCol,
                    gridRow: layoutRow * 2 + 1,
                    gridCol: layoutCol * 2 + 1
                });
                
                // 计算每个格子的样式（外层容器）
                styles.push({
                    width: widthPercent + '%'
                });
            }
            
            this.displayCells = cells;
            this.style = styles;
            
            const metrics = {
                layoutRows: rows,
                layoutCols: perRow,
                gridRows: rows * 2 + 1,
                gridCols: perRow * 2 + 1
            };
            this.boardMetrics = metrics;
            this.gridDimensions = {
                gridRows: metrics.gridRows,
                gridCols: metrics.gridCols
            };
            this.entrancePosition = this.getEntrancePosition();
            this.$nextTick(() => this.updatePathVisualization());
        },
        isSelected(areaId) {
            return this.selectedAreaIds.indexOf(areaId) > -1;
        },
        toggleSelection(areaId) {
            const index = this.selectedAreaIds.indexOf(areaId);
            if (index > -1) {
                this.selectedAreaIds.splice(index, 1);
            } else {
                this.selectedAreaIds.push(areaId);
            }
            this.clearPathResults(false);
            this.persistState();
        },
        getRouteBadge(areaId) {
            const index = this.routeOrder.indexOf(areaId);
            return index > -1 ? index + 1 : '';
        },
        shortLabel(text) {
            if (!text) {
                return '—';
            }
            return text.length > 4 ? text.slice(0, 4) : text;
        },
        getAreaTooltip(area) {
            return (area.areaName || '未命名货区') +
                ' / 编码：' +
                (area.areaCode || '-') +
                (area.wareName ? ' / 仓库：' + area.wareName : '');
        },
        clearSelections() {
            this.selectedAreaIds = [];
            this.clearPathResults(true);
        },
        buildGrid() {
            if (!this.boardMetrics.gridRows || !this.boardMetrics.gridCols) {
                this.gridDimensions = {
                    gridRows: 0,
                    gridCols: 0
                };
                return [];
            }
            const rows = this.boardMetrics.gridRows;
            const cols = this.boardMetrics.gridCols;
            const grid = Array.from({ length: rows }, () => Array(cols).fill(0));
            this.displayCells.forEach(cell => {
                grid[cell.gridRow][cell.gridCol] = 9;
            });
            this.gridDimensions = {
                gridRows: rows,
                gridCols: cols
            };
            this.entrancePosition = this.getEntrancePosition();
            return grid;
        },
        getAreaPositionById(areaId) {
            const cell = this.displayCells.find(item => item.area && item.area.areaId === areaId);
            if (!cell) {
                return null;
            }
            // 返回格子正下方的通道交叉点：(下方通道, 左侧通道)
            // gridRow是奇数（格子行），+1得到格子下方的通道（偶数）
            // gridCol是奇数（格子列），-1得到格子左侧的通道（偶数）
            // 确保行和列都是偶数坐标（通道交叉点）
            return {
                row: cell.gridRow + 1,
                col: cell.gridCol - 1
            };
        },
        startPathfinding() {
            if (!areaPathfindingService) {
                $.modal.alertError('路径规划服务未加载');
                return;
            }
            if (!this.selectedAreaIds || this.selectedAreaIds.length === 0) {
                $.modal.msg('请先选择需要访问的货区');
                return;
            }
            // 确保布局是最新的
            if (!this.boardMetrics.gridRows || !this.boardMetrics.gridCols) {
                this.rebuildBoardLayout();
            }
            this.stopSimulation();
            this.simulationStates = {};
            this.pathSimulation.completed = false;
            this.pathSimulation.stoppedManually = false;
            this.pathSimulation.currentIndex = -1;
            // 重新构建网格，确保使用最新的布局
            const grid = this.buildGrid();
            if (!grid || !grid.length) {
                $.modal.alertWarning('未找到可用的货区布局');
                return;
            }
            // 重新计算入口位置，确保使用最新的布局
            const start = this.getEntrancePosition();
            this.entrancePosition = start;
            if (!start) {
                $.modal.alertWarning('未能确定仓库入口位置');
                return;
            }
            const targets = [];
            const meta = [];
            // 重新获取每个选中货区的位置，确保使用最新的布局
            for (let i = 0; i < this.selectedAreaIds.length; i++) {
                const areaId = this.selectedAreaIds[i];
                const position = this.getAreaPositionById(areaId);
                if (!position) {
                    console.warn('无法找到货区位置:', areaId);
                    continue;
                }
                targets.push(position);
                meta.push({
                    areaId: areaId,
                    position: position
                });
            }
            if (targets.length === 0) {
                $.modal.alertWarning('所选货区无效，请重新选择');
                return;
            }
            console.log('路径规划参数:', {
                gridSize: `${grid.length}x${grid[0].length}`,
                start: start,
                targets: targets,
                layoutCols: this.boardMetrics.layoutCols,
                layoutRows: this.boardMetrics.layoutRows
            });
            const that = this;
            areaPathfindingService.optimizeRoute(grid, start, targets, false).then(function(result) {
                that.pathData = result;
                that.updatePathVisualization();
                if (!result || result.distance === Infinity) {
                    $.modal.alertError('无法找到有效路径，请检查货区布局设置');
                    that.routeOrder = [];
                    that.persistState();
                    return;
                }
                if (Array.isArray(result.order) && result.order.length > 0) {
                    const ordered = [];
                    result.order.forEach(orderIdx => {
                        const targetMeta = meta[orderIdx];
                        if (targetMeta) {
                            ordered.push(targetMeta.areaId);
                        }
                    });
                    that.routeOrder = ordered;
                } else {
                    that.routeOrder = meta.map(item => item.areaId);
                }
                that.persistState();
                $.modal.msg('路径计算完成，建议访问 ' + that.routeOrder.length + ' 个货区');
            }).catch(function(e) {
                console.error('Area path error:', e);
                $.modal.alertError('路径计算失败：' + (e && e.message ? e.message : '未知错误'));
            });
        },
        clearPathResults(shouldPersist) {
            this.stopSimulation();
            this.simulationStates = {};
            this.pathSimulation.completed = false;
            this.pathSimulation.stoppedManually = false;
            this.pathSimulation.currentIndex = -1;
            this.pathData = null;
            this.routeOrder = [];
            this.clearPathVisualization();
            if (shouldPersist !== false) {
                this.persistState();
            }
        },
        startSimulation() {
            if (!this.canStartSimulation) {
                $.modal && $.modal.msg('请先计算路径');
                return;
            }
            if (!this.routeOrder || this.routeOrder.length === 0) {
                $.modal && $.modal.msg('无可模拟的路径顺序');
                return;
            }
            this.stopSimulation();
            this.simulationStates = {};
            this.routeOrder.forEach(id => {
                if (id != null) {
                    this.$set(this.simulationStates, id, 'pending');
                }
            });
            this.pathSimulation.running = true;
            this.pathSimulation.paused = false;
            this.pathSimulation.completed = false;
            this.pathSimulation.stoppedManually = false;
            this.pathSimulation.currentIndex = -1;
            this.startPathAnimation();
            this.advanceSimulationStep();
            this.pathSimulation.timerId = setInterval(() => {
                if (!this.pathSimulation.running || this.pathSimulation.paused) {
                    return;
                }
                this.advanceSimulationStep();
            }, this.pathSimulation.intervalMs);
        },
        advanceSimulationStep() {
            if (!this.routeOrder || this.routeOrder.length === 0) {
                this.stopSimulation();
                return;
            }
            const nextIndex = this.pathSimulation.currentIndex + 1;
            if (nextIndex >= this.routeOrder.length) {
                this.stopSimulation({ clearStates: false, completed: true });
                $.modal && $.modal.msg('路径模拟完成');
                return;
            }
            if (this.pathSimulation.currentIndex >= 0) {
                const prevId = this.routeOrder[this.pathSimulation.currentIndex];
                if (prevId != null) {
                    this.$set(this.simulationStates, prevId, 'visited');
                }
            }
            const currentId = this.routeOrder[nextIndex];
            if (currentId != null) {
                this.markCurrentSimulation(currentId);
            }
            this.pathSimulation.currentIndex = nextIndex;
        },
        markCurrentSimulation(areaId) {
            Object.keys(this.simulationStates).forEach(key => {
                if (this.simulationStates[key] === 'current') {
                    this.$set(this.simulationStates, key, 'visited');
                }
            });
            this.$set(this.simulationStates, areaId, 'current');
        },
        togglePause() {
            if (!this.canTogglePause) {
                return;
            }
            if (!this.pathSimulation.running && !this.pathSimulation.paused) {
                return;
            }
            this.pathSimulation.paused = !this.pathSimulation.paused;
            if (this.pathSimulation.paused) {
                this.pausePathAnimation();
            } else {
                this.resumePathAnimation();
            }
        },
        stopSimulation(options) {
            const cfg = Object.assign({
                clearStates: true,
                completed: false
            }, options);
            const hadActivity = this.pathSimulation.running || this.pathSimulation.paused || this.pathSimulation.currentIndex >= 0;
            if (this.pathSimulation.timerId) {
                clearInterval(this.pathSimulation.timerId);
                this.pathSimulation.timerId = null;
            }
            this.stopPathAnimation(false);
            this.pathSimulation.running = false;
            this.pathSimulation.paused = false;
            this.pathSimulation.completed = cfg.completed;
            this.pathSimulation.stoppedManually = !cfg.completed && hadActivity;
            if (cfg.completed && !cfg.clearStates) {
                const sequence = this.routeOrder || [];
                sequence.forEach(id => {
                    if (id != null) {
                        this.$set(this.simulationStates, id, 'visited');
                    }
                });
                this.pathSimulation.currentIndex = sequence.length - 1;
            } else {
                this.pathSimulation.currentIndex = -1;
                if (cfg.clearStates) {
                    this.simulationStates = {};
                }
            }
        },
        cellClass(cell) {
            const classes = [];
            if (!cell.area) {
                return classes;
            }
            
            // 添加状态颜色类：只有空闲(0)和使用中(1)两种状态
            const status = cell.area.status || 0;
            if (status === 1) {
                classes.push('success'); // 使用中 - 绿色
            }
            // status === 0 为空闲状态，使用默认灰色
            
            if (this.isSelected(cell.area.areaId)) {
                classes.push('selected');
            }
            if (this.getRouteBadge(cell.area.areaId)) {
                classes.push('path-highlight');
            }
            // 移除变色功能 - 不再根据访问顺序改变货区颜色
            return classes;
        },
        
        updateAreaStats() {
            const stats = {
                empty: 0,
                occupied: 0
            };
            
            this.areas.forEach(area => {
                const status = area.status || 0;
                if (status === 0) {
                    stats.empty++;
                } else if (status === 1) {
                    stats.occupied++;
                }
            });
            
            this.areaStats = stats;
        },
        showContextMenu(cell, event) {
            if (!cell || !cell.area) {
                return;
            }
            const area = cell.area;
            const items = [
                { label: '货区名称', value: area.areaName || '-' },
                { label: '货区编码', value: area.areaCode || '-' },
                { label: '所属仓库', value: area.wareName || '-' },
                { label: '位置', value: `第${cell.layoutRow + 1}行 第${cell.layoutCol + 1}列` }
            ];
            this.contextMenu = {
                visible: true,
                title: '货区信息',
                items: items,
                style: {
                    left: event.clientX + 'px',
                    top: event.clientY + 'px'
                }
            };
        },
        hideContextMenu() {
            this.contextMenu.visible = false;
        },
        getEntrancePosition() {
            if (!this.boardMetrics.layoutCols) {
                return null;
            }
            // 计算中间位置的通道（偶数列）
            const middleCell = Math.max(1, Math.ceil(this.boardMetrics.layoutCols / 2));
            const col = (middleCell - 1) * 2;  // 去掉+1，确保是偶数（通道）
            return {
                row: 0,  // 顶部通道（偶数）
                col: col // 中间通道（偶数）
            };
        },
        initPathVisualizer() {
            if (this.pathVisualizer || typeof WarehousePathVisualizer === 'undefined') {
                return;
            }
            this.pathVisualizer = new WarehousePathVisualizer('areaPathCanvas');
        },
        updatePathVisualization() {
            if (!this.displayCells.length) {
                this.clearPathVisualization();
                return;
            }
            if (!this.pathData || !this.pathData.path || this.pathData.path.length === 0) {
                this.clearPathVisualization();
                return;
            }
            
            // 初始化canvas，使用requestAnimationFrame确保DOM稳定后再绘制
            this.$nextTick(() => {
                requestAnimationFrame(() => {
                    const canvas = document.getElementById('areaPathCanvas');
                    if (!canvas) return;
                    
                    const container = canvas.parentElement;
                    // 固定canvas尺寸，避免后续DOM变化影响
                    const containerWidth = container.offsetWidth;
                    const containerHeight = container.offsetHeight;
                    canvas.width = containerWidth;
                    canvas.height = containerHeight;
                    canvas.style.width = containerWidth + 'px';
                    canvas.style.height = containerHeight + 'px';
                    
                    // 使用最新的布局指标计算路径点位置
                    const maxRow = this.boardMetrics.layoutRows || 1;
                    const maxCol = this.boardMetrics.layoutCols || 1;
                    const cellWidth = containerWidth / maxCol;
                    const cellHeight = containerHeight / maxRow;
                    
                    // 路径走格子之间的通道或格子中心（访问格子时）
                    // 偶数坐标=通道，奇数坐标=格子中心
                    const pathPoints = this.pathData.path.map(pos => {
                        const paddingPx = 8;  // CSS中定义的padding固定值
                        
                        // X坐标：偶数列在通道中心，奇数列在格子中心
                        let x;
                        if (pos.col % 2 === 0) {
                            // 通道列：走在通道正中间
                            x = (pos.col / 2) * cellWidth + paddingPx;
                        } else {
                            // 格子列：走在格子中心（访问格子时）
                            x = Math.floor(pos.col / 2) * cellWidth + cellWidth / 2;
                        }
                        
                        // Y坐标：偶数行在通道中心，奇数行在格子中心
                        let y;
                        if (pos.row % 2 === 0) {
                            // 通道行：走在通道正中间
                            y = (pos.row / 2) * cellHeight + paddingPx;
                        } else {
                            // 格子行：走在格子中心（访问格子时）
                            y = Math.floor(pos.row / 2) * cellHeight + cellHeight / 2;
                        }
                        
                        return { x, y, gridRow: pos.row, gridCol: pos.col };
                    });
                    
                    this.drawPath(canvas, pathPoints);
                });
            });
        },
        
        drawPath(canvas, points) {
            if (!points || points.length < 2) return;
            
            const ctx = canvas.getContext('2d');
            ctx.clearRect(0, 0, canvas.width, canvas.height);
            
            ctx.lineWidth = 4;
            ctx.lineCap = 'round';
            ctx.lineJoin = 'round';
            
            const startPoint = points[0];
            const endPoint = points[points.length - 1];
            const gradient = ctx.createLinearGradient(startPoint.x, startPoint.y, endPoint.x, endPoint.y);
            gradient.addColorStop(0, '#2EC7FF');
            gradient.addColorStop(0.5, '#36D1A8');
            gradient.addColorStop(1, '#FFBA00');
            ctx.strokeStyle = gradient;
            ctx.shadowColor = 'rgba(30, 136, 229, 0.45)';
            ctx.shadowBlur = 8;
            
            ctx.beginPath();
            ctx.moveTo(startPoint.x, startPoint.y);
            for (let i = 1; i < points.length; i++) {
                ctx.lineTo(points[i].x, points[i].y);
            }
            ctx.stroke();
            
            // 绘制终点标记
            const lastPoint = points[points.length - 1];
            ctx.fillStyle = 'rgba(64, 158, 255, 0.9)';
            ctx.beginPath();
            ctx.arc(lastPoint.x, lastPoint.y, 7, 0, Math.PI * 2);
            ctx.fill();
            ctx.fillStyle = 'rgba(64, 158, 255, 0.25)';
            ctx.beginPath();
            ctx.arc(lastPoint.x, lastPoint.y, 14, 0, Math.PI * 2);
            ctx.fill();
        },
        clearPathVisualization() {
            const canvas = document.getElementById('areaPathCanvas');
            if (canvas) {
                const ctx = canvas.getContext('2d');
                ctx && ctx.clearRect(0, 0, canvas.width, canvas.height);
            }
        },
        handleResize() {
            if (!this.pathVisualizer || !this.displayCells.length) {
                return;
            }
            this.pathVisualizer.render();
        },
        startPathAnimation() {
            if (!this.pathData || !this.pathData.path || this.pathData.path.length < 2) {
                return;
            }
            const that = this;
            this.animatePathProgress = 0;
            this.animatePathLastTime = null;
            this.animatePathFrameId = requestAnimationFrame(function(ts) { that.animatePathStep(ts); });
        },
        
        animatePathStep(timestamp) {
            const that = this;
            if (!that.animatePathLastTime) {
                that.animatePathLastTime = timestamp;
            }
            const delta = (timestamp - that.animatePathLastTime) / 1000;
            that.animatePathLastTime = timestamp;
            
            // 计算动画速度：路径总步数 / (访问间隔 * 访问点数)
            // 使动画在所有货区访问完成时正好结束
            const totalSegments = that.pathData.path.length - 1;
            const visitCount = that.routeOrder && that.routeOrder.length > 0 ? that.routeOrder.length : 1;
            const totalDuration = (that.pathSimulation.intervalMs / 1000) * visitCount; // 总时长（秒）
            const speed = totalSegments / totalDuration; // 每秒前进的步数
            
            that.animatePathProgress += delta * speed;
            
            if (that.animatePathProgress >= totalSegments) {
                that.animatePathProgress = totalSegments;
            }
            
            that.drawPathAnimated(that.animatePathProgress);
            
            if (that.animatePathProgress < totalSegments) {
                that.animatePathFrameId = requestAnimationFrame(function(ts) { that.animatePathStep(ts); });
            }
        },
        
        drawPathAnimated(progress) {
            const canvas = document.getElementById('areaPathCanvas');
            if (!canvas) return;
            
            // 使用canvas的固定尺寸，而不是重新获取容器尺寸
            const canvasWidth = canvas.width;
            const canvasHeight = canvas.height;
            const maxRow = this.boardMetrics.layoutRows || 1;
            const maxCol = this.boardMetrics.layoutCols || 1;
            const cellWidth = canvasWidth / maxCol;
            const cellHeight = canvasHeight / maxRow;
            
            // 路径走格子之间的通道或格子中心（访问格子时）
            // 偶数坐标=通道，奇数坐标=格子中心
            const pathPoints = this.pathData.path.map(pos => {
                const paddingPx = 8;  // CSS中定义的padding固定值
                
                // X坐标：偶数列在通道中心，奇数列在格子中心
                let x;
                if (pos.col % 2 === 0) {
                    // 通道列：走在通道正中间
                    x = (pos.col / 2) * cellWidth + paddingPx;
                } else {
                    // 格子列：走在格子中心（访问格子时）
                    x = Math.floor(pos.col / 2) * cellWidth + cellWidth / 2;
                }
                
                // Y坐标：偶数行在通道中心，奇数行在格子中心
                let y;
                if (pos.row % 2 === 0) {
                    // 通道行：走在通道正中间
                    y = (pos.row / 2) * cellHeight + paddingPx;
                } else {
                    // 格子行：走在格子中心（访问格子时）
                    y = Math.floor(pos.row / 2) * cellHeight + cellHeight / 2;
                }
                
                return { x, y, gridRow: pos.row, gridCol: pos.col };
            });
            
            const ctx = canvas.getContext('2d');
            ctx.clearRect(0, 0, canvas.width, canvas.height);
            
            const maxIndex = Math.min(Math.floor(progress), pathPoints.length - 1);
            const fraction = Math.min(progress - Math.floor(progress), 1);
            
            if (maxIndex < 0) return;
            
            // 绘制未走过的路径（灰色虚线）
            if (maxIndex < pathPoints.length - 1) {
                ctx.save();
                ctx.lineWidth = 5;
                ctx.lineCap = 'round';
                ctx.lineJoin = 'round';
                ctx.strokeStyle = 'rgba(150, 150, 150, 0.7)';
                ctx.setLineDash([10, 6]);
                ctx.beginPath();
                
                if (maxIndex >= 0) {
                    // 从当前位置开始绘制未走的路径
                    const currentPoint = pathPoints[maxIndex];
                    const nextPoint = pathPoints[maxIndex + 1];
                    const interpX = currentPoint.x + (nextPoint.x - currentPoint.x) * fraction;
                    const interpY = currentPoint.y + (nextPoint.y - currentPoint.y) * fraction;
                    ctx.moveTo(interpX, interpY);
                    
                    for (let i = maxIndex + 1; i < pathPoints.length; i++) {
                        ctx.lineTo(pathPoints[i].x, pathPoints[i].y);
                    }
                } else {
                    ctx.moveTo(pathPoints[0].x, pathPoints[0].y);
                    for (let i = 1; i < pathPoints.length; i++) {
                        ctx.lineTo(pathPoints[i].x, pathPoints[i].y);
                    }
                }
                ctx.stroke();
                ctx.restore();
            }
            
            // 绘制已走过的路径（彩色渐变，更粗）
            ctx.lineWidth = 8;
            ctx.lineCap = 'round';
            ctx.lineJoin = 'round';
            
            const startPoint = pathPoints[0];
            const endPoint = pathPoints[pathPoints.length - 1];
            const gradient = ctx.createLinearGradient(startPoint.x, startPoint.y, endPoint.x, endPoint.y);
            gradient.addColorStop(0, '#00B8FF');
            gradient.addColorStop(0.5, '#00E676');
            gradient.addColorStop(1, '#FFD700');
            ctx.strokeStyle = gradient;
            ctx.shadowColor = 'rgba(0, 184, 255, 0.8)';
            ctx.shadowBlur = 15;
            
            ctx.beginPath();
            ctx.moveTo(startPoint.x, startPoint.y);
            for (let i = 1; i <= maxIndex; i++) {
                ctx.lineTo(pathPoints[i].x, pathPoints[i].y);
            }
            
            let marker = pathPoints[pathPoints.length - 1];
            if (maxIndex < pathPoints.length - 1) {
                const currentPoint = pathPoints[maxIndex];
                const nextPoint = pathPoints[maxIndex + 1];
                
                // 严格对齐：插值也保持在通道中心线上
                const interpX = currentPoint.x + (nextPoint.x - currentPoint.x) * fraction;
                const interpY = currentPoint.y + (nextPoint.y - currentPoint.y) * fraction;
                
                // 穿模检测
                const markerGridRow = Math.round(currentPoint.gridRow + (nextPoint.gridRow - currentPoint.gridRow) * fraction);
                const markerGridCol = Math.round(currentPoint.gridCol + (nextPoint.gridCol - currentPoint.gridCol) * fraction);
                
                // 检查圆心是否在合法的通道上（偶数坐标）
                if (markerGridRow % 2 !== 0 || markerGridCol % 2 !== 0) {
                    console.warn('检测到潜在穿模！圆心位置:', {
                        gridRow: markerGridRow,
                        gridCol: markerGridCol,
                        x: interpX,
                        y: interpY
                    });
                }
                
                ctx.lineTo(interpX, interpY);
                marker = { x: interpX, y: interpY };
            }
            ctx.stroke();
            
            // 绘制起点标记
            ctx.shadowBlur = 0;
            ctx.fillStyle = 'rgba(46, 199, 255, 0.8)';
            ctx.beginPath();
            ctx.arc(startPoint.x, startPoint.y, 5, 0, Math.PI * 2);
            ctx.fill();
            ctx.strokeStyle = '#fff';
            ctx.lineWidth = 2;
            ctx.stroke();
            
            // 绘制终点标记
            ctx.fillStyle = 'rgba(255, 186, 0, 0.8)';
            ctx.beginPath();
            ctx.arc(endPoint.x, endPoint.y, 5, 0, Math.PI * 2);
            ctx.fill();
            ctx.strokeStyle = '#fff';
            ctx.lineWidth = 2;
            ctx.stroke();
            
            // 绘制当前位置标记（移动的圆）
            if (marker) {
                // 通道宽度是padding的2倍 = 16px
                // 圆的最大半径应该小于通道宽度的一半，以防穿模
                const paddingPx = 8;
                const channelWidth = paddingPx * 2;  // 16px
                const maxRadius = Math.min(channelWidth * 0.45, 7);  // 最大半径为通道的45%（约7px），留有余地
                
                // 外层光晕
                ctx.fillStyle = 'rgba(64, 158, 255, 0.15)';
                ctx.beginPath();
                ctx.arc(marker.x, marker.y, maxRadius * 1.8, 0, Math.PI * 2);
                ctx.fill();
                
                // 中层光晕
                ctx.fillStyle = 'rgba(64, 158, 255, 0.3)';
                ctx.beginPath();
                ctx.arc(marker.x, marker.y, maxRadius * 1.3, 0, Math.PI * 2);
                ctx.fill();
                
                // 核心圆
                ctx.fillStyle = 'rgba(64, 158, 255, 0.95)';
                ctx.beginPath();
                ctx.arc(marker.x, marker.y, maxRadius, 0, Math.PI * 2);
                ctx.fill();
                
                // 白色边框
                ctx.strokeStyle = '#fff';
                ctx.lineWidth = 1.5;
                ctx.stroke();
            }
        },
        
        pausePathAnimation() {
            if (this.animatePathFrameId) {
                cancelAnimationFrame(this.animatePathFrameId);
                this.animatePathFrameId = null;
            }
        },
        resumePathAnimation() {
            const that = this;
            if (!this.animatePathFrameId && this.pathData) {
                this.animatePathLastTime = null;
                this.animatePathFrameId = requestAnimationFrame(function(ts) { that.animatePathStep(ts); });
            }
        },
        stopPathAnimation(clearCanvas) {
            if (this.animatePathFrameId) {
                cancelAnimationFrame(this.animatePathFrameId);
                this.animatePathFrameId = null;
            }
            this.animatePathProgress = 0;
            this.animatePathLastTime = null;
            if (clearCanvas) {
                this.clearPathVisualization();
            }
        },
        restoreFromCache() {
            try {
                const raw = localStorage.getItem(this.cacheKey);
                if (!raw) {
                    return;
                }
                const payload = JSON.parse(raw);
                if (Array.isArray(payload.selected)) {
                    this.selectedAreaIds = payload.selected;
                }
                if (Array.isArray(payload.route)) {
                    this.routeOrder = payload.route;
                }
            } catch (e) {
                console.warn('Failed to restore area overview cache', e);
            }
        },
        persistState() {
            try {
                const payload = {
                    selected: this.selectedAreaIds,
                    route: this.routeOrder,
                    timestamp: Date.now()
                };
                localStorage.setItem(this.cacheKey, JSON.stringify(payload));
            } catch (e) {
                console.warn('Failed to persist area overview cache', e);
            }
        }
    },
    beforeDestroy() {
        this.stopSimulation();
        this.clearPathVisualization();
        if (this.resizeHandler) {
            window.removeEventListener('resize', this.resizeHandler);
        }
        document.removeEventListener('click', this.hideContextMenu.bind(this));
    }
});

