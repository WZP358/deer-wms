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
        tooltip: {
            visible: false,
            title: '',
            subtitle: '',
            extra: '',
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
            intervalMs: 1800,
            completed: false,
            stoppedManually: false
        },
        simulationStates: {},
        pathVisualizer: null,
        resizeHandler: null
    },
    computed: {
        boardGridStyle() {
            const cols = this.boardMetrics.layoutCols || 1;
            return {
                gridTemplateColumns: `repeat(${cols}, minmax(82px, 1fr))`
            };
        },
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
                    console.log('解析后的货区列表:', that.areas);
                    that.reconcileSelections();
                    that.rebuildBoardLayout();
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
        rebuildBoardLayout() {
            if (!this.areas || this.areas.length === 0) {
                this.displayCells = [];
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
            const perRow = Math.max(1, Math.min(this.gridSettings.columns, Math.ceil(Math.sqrt(this.areas.length))));
            const rows = Math.max(Math.ceil(this.areas.length / perRow), this.gridSettings.minRows);
            const totalSlots = rows * perRow;
            const cells = [];
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
            }
            this.displayCells = cells;
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
            return {
                row: cell.gridRow + 1,
                col: cell.gridCol
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
            this.stopSimulation();
            this.simulationStates = {};
            this.pathSimulation.completed = false;
            this.pathSimulation.stoppedManually = false;
            this.pathSimulation.currentIndex = -1;
            const grid = this.buildGrid();
            if (!grid || !grid.length) {
                $.modal.alertWarning('未找到可用的货区布局');
                return;
            }
            const start = this.entrancePosition;
            if (!start) {
                $.modal.alertWarning('未能确定仓库入口位置');
                return;
            }
            const targets = [];
            const meta = [];
            for (let i = 0; i < this.selectedAreaIds.length; i++) {
                const areaId = this.selectedAreaIds[i];
                const position = this.getAreaPositionById(areaId);
                if (!position) {
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
            const classes = ['warehouse-cell'];
            if (!cell.area) {
                classes.push('placeholder');
                return classes;
            }
            if (this.isSelected(cell.area.areaId)) {
                classes.push('is-selected');
            }
            if (this.getRouteBadge(cell.area.areaId)) {
                classes.push('has-route');
            }
            const simCls = this.simulationClass(cell.area.areaId);
            if (simCls) {
                classes.push(simCls);
            }
            return classes;
        },
        showCellTooltip(cell, event) {
            if (!cell || !cell.area) {
                return;
            }
            const stage = this.$refs.boardStage;
            const stageRect = stage ? stage.getBoundingClientRect() : null;
            const targetRect = event.currentTarget.getBoundingClientRect();
            let left = targetRect.left + targetRect.width / 2;
            let top = targetRect.top;
            if (stageRect) {
                left -= stageRect.left;
                top -= stageRect.top;
            }
            this.tooltip = {
                visible: true,
                title: cell.area.areaName || cell.area.areaCode || '货区',
                subtitle: `编码：${cell.area.areaCode || '-'}`,
                extra: cell.area.wareName ? `仓库：${cell.area.wareName}` : '',
                style: {
                    left: `${left}px`,
                    top: `${top}px`,
                    transform: 'translate(-50%, -110%)'
                }
            };
        },
        hideCellTooltip() {
            this.tooltip.visible = false;
        },
        getEntrancePosition() {
            if (!this.boardMetrics.layoutCols) {
                return null;
            }
            const middleCell = Math.max(1, Math.ceil(this.boardMetrics.layoutCols / 2));
            const col = (middleCell - 1) * 2 + 1;
            return {
                row: 0,
                col: col
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
            if (!this.pathVisualizer) {
                this.initPathVisualizer();
            }
            if (!this.pathVisualizer) {
                return;
            }
            this.pathVisualizer.setMetrics({
                layoutRows: this.boardMetrics.layoutRows || 1,
                layoutCols: this.boardMetrics.layoutCols || 1
            });
            const path = this.pathData && Array.isArray(this.pathData.path) ? this.pathData.path : [];
            this.pathVisualizer.setPath(path);
            this.$nextTick(() => this.pathVisualizer.render());
        },
        clearPathVisualization() {
            if (this.pathVisualizer) {
                this.stopPathAnimation(true);
                this.pathVisualizer.setPath([]);
                this.pathVisualizer.clear();
            }
        },
        handleResize() {
            if (!this.pathVisualizer || !this.displayCells.length) {
                return;
            }
            this.pathVisualizer.render();
        },
        startPathAnimation() {
            if (!this.pathVisualizer || !this.pathData || !this.pathData.path || this.pathData.path.length < 2) {
                return;
            }
            this.pathVisualizer.startAnimation({
                speed: 2.4
            });
        },
        pausePathAnimation() {
            if (this.pathVisualizer) {
                this.pathVisualizer.pauseAnimation();
            }
        },
        resumePathAnimation() {
            if (this.pathVisualizer) {
                this.pathVisualizer.resumeAnimation();
            }
        },
        stopPathAnimation(clearCanvas) {
            if (!this.pathVisualizer) {
                return;
            }
            this.pathVisualizer.stopAnimation(!!clearCanvas);
            if (!clearCanvas && this.pathData && this.pathData.path && this.pathData.path.length > 1) {
                this.pathVisualizer.render();
            }
        },
        simulationClass(areaId) {
            const state = this.simulationStates[areaId];
            if (state === 'current') {
                return 'sim-current';
            }
            if (state === 'visited') {
                return 'sim-visited';
            }
            return '';
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
    }
});

