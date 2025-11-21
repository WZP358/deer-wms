var shelfPathfindingService = typeof PathfindingService !== 'undefined' ? new PathfindingService() : null;

new Vue({
    el: '#shelf-overview',
    data: {
        areas: [],
        shelves: [],
        currentAreaId: '',
        selectedShelfIds: [],
        pathData: null,
        routeOrder: [],
        cacheKey: 'wms/shelfRoutePlan',
        areaCacheKey: 'wms/areaRoutePlan',
        currentAreaIdFromCache: null,
        gridSettings: {
            columns: 12,
            minRows: 4
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
        entrancePosition: null,
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
        orderedShelves() {
            if (!this.routeOrder || this.routeOrder.length === 0) {
                return [];
            }
            const result = [];
            this.routeOrder.forEach(id => {
                const shelf = this.shelves.find(item => item.shelfId === id);
                if (shelf) {
                    result.push(shelf);
                }
            });
            return result;
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
        this.restoreState();
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
                cache: true,
                type: 'POST',
                url: '/system/areaInfo/list',
                data: {
                    pageNum: 1,
                    pageSize: 999
                },
                success(data) {
                    that.areas = data && data.rows ? data.rows : [];
                    that.applyDefaultArea();
                },
                error() {
                    $.modal.alertError('货区数据加载失败');
                }
            });
        },
        applyDefaultArea() {
            if (this.areas.length === 0) {
                this.currentAreaId = '';
                this.shelves = [];
                return;
            }
            if (!this.currentAreaId) {
                const cachedAreaId = this.currentAreaIdFromCache || this.getSuggestedAreaId();
                if (cachedAreaId) {
                    this.currentAreaId = cachedAreaId;
                } else {
                    this.currentAreaId = this.areas[0].areaId;
                }
            }
            if (this.currentAreaId) {
                this.loadShelves(this.currentAreaId);
            }
        },
        getSuggestedAreaId() {
            try {
                const raw = localStorage.getItem(this.areaCacheKey);
                if (!raw) {
                    return null;
                }
                const payload = JSON.parse(raw);
                if (Array.isArray(payload.route) && payload.route.length > 0) {
                    return payload.route[0];
                }
                if (Array.isArray(payload.selected) && payload.selected.length > 0) {
                    return payload.selected[0];
                }
            } catch (e) {
                console.warn('Failed to read area overview cache', e);
            }
            return null;
        },
        handleAreaChange() {
            if (!this.currentAreaId) {
                this.shelves = [];
                this.selectedShelfIds = [];
                this.clearPathResults(true);
                return;
            }
            this.loadShelves(this.currentAreaId);
        },
        loadShelves(areaId) {
            var that = this;
            $.ajax({
                cache: true,
                type: 'POST',
                url: '/system/shelfInfo/listByArea',
                data: {
                    areaId: areaId
                },
                success(data) {
                    that.shelves = data || [];
                    that.selectedShelfIds = that.selectedShelfIds.filter(id => that.shelves.find(item => item.shelfId === id));
                    that.rebuildBoardLayout();
                    that.clearPathResults(false);
                    that.persistState();
                },
                error() {
                    $.modal.alertError('货架数据加载失败');
                }
            });
        },
        isShelfSelected(shelfId) {
            return this.selectedShelfIds.indexOf(shelfId) > -1;
        },
        toggleShelfSelection(shelfId) {
            const index = this.selectedShelfIds.indexOf(shelfId);
            if (index > -1) {
                this.selectedShelfIds.splice(index, 1);
            } else {
                this.selectedShelfIds.push(shelfId);
            }
            this.clearPathResults(false);
            this.persistState();
        },
        getRouteBadge(shelfId) {
            const index = this.routeOrder.indexOf(shelfId);
            return index > -1 ? index + 1 : '';
        },
        shortLabel(text) {
            if (!text) {
                return '—';
            }
            return text.length > 4 ? text.slice(0, 4) : text;
        },
        getShelfTooltip(shelf) {
            const base = shelf.shelfName || '未命名货架';
            const code = shelf.shelfCode ? ' / 编码：' + shelf.shelfCode : '';
            const size = (shelf.shelfRow || 0) + '×' + (shelf.shelfColumn || 0);
            return base + code + ' / 尺寸：' + size;
        },
        clearSelections() {
            this.selectedShelfIds = [];
            this.clearPathResults(true);
        },
        rebuildBoardLayout() {
            if (!this.shelves || this.shelves.length === 0) {
                this.displayCells = [];
                this.boardMetrics = {
                    layoutRows: 0,
                    layoutCols: 0,
                    gridRows: 0,
                    gridCols: 0
                };
                this.entrancePosition = null;
                this.clearPathVisualization();
                return;
            }
            const perRow = Math.max(1, Math.min(this.gridSettings.columns, Math.ceil(Math.sqrt(this.shelves.length))));
            const rows = Math.max(Math.ceil(this.shelves.length / perRow), this.gridSettings.minRows);
            const totalSlots = rows * perRow;
            const cells = [];
            for (let i = 0; i < totalSlots; i++) {
                const shelf = this.shelves[i] || null;
                const layoutRow = Math.floor(i / perRow);
                const layoutCol = i % perRow;
                cells.push({
                    key: shelf ? 'shelf-' + shelf.shelfId : 'placeholder-' + i,
                    shelf: shelf,
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
            this.entrancePosition = this.getEntrancePosition();
            this.$nextTick(() => this.updatePathVisualization());
        },
        buildGrid() {
            if (!this.boardMetrics.gridRows || !this.boardMetrics.gridCols) {
                return {
                    grid: [],
                    start: null
                };
            }
            const rows = this.boardMetrics.gridRows;
            const cols = this.boardMetrics.gridCols;
            const grid = Array.from({ length: rows }, () => Array(cols).fill(0));
            this.displayCells.forEach(cell => {
                grid[cell.gridRow][cell.gridCol] = 9;
            });
            return {
                grid: grid,
                start: this.getEntrancePosition()
            };
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
        getShelfPositionById(shelfId) {
            const cell = this.displayCells.find(item => item.shelf && item.shelf.shelfId === shelfId);
            if (!cell) {
                return null;
            }
            return {
                row: cell.gridRow + 1,
                col: cell.gridCol
            };
        },
        startPathfinding() {
            if (!shelfPathfindingService) {
                $.modal.alertError('路径规划服务未加载');
                return;
            }
            if (!this.currentAreaId) {
                $.modal.msg('请先选择货区');
                return;
            }
            if (!this.selectedShelfIds || this.selectedShelfIds.length === 0) {
                $.modal.msg('请先选择需要访问的货架');
                return;
            }
            this.stopSimulation();
            this.simulationStates = {};
            this.pathSimulation.completed = false;
            this.pathSimulation.stoppedManually = false;
            this.pathSimulation.currentIndex = -1;
            const { grid, start } = this.buildGrid();
            if (!grid || !grid.length || !start) {
                $.modal.alertWarning('未找到可用的货架布局');
                return;
            }
            const targets = [];
            const meta = [];
            for (let i = 0; i < this.selectedShelfIds.length; i++) {
                const shelfId = this.selectedShelfIds[i];
                const position = this.getShelfPositionById(shelfId);
                if (!position) {
                    continue;
                }
                targets.push(position);
                meta.push({
                    shelfId: shelfId,
                    position: position
                });
            }
            if (targets.length === 0) {
                $.modal.alertWarning('所选货架无效，请重新选择');
                return;
            }
            const that = this;
            shelfPathfindingService.optimizeRoute(grid, start, targets, false).then(function(result) {
                that.pathData = result;
                that.updatePathVisualization();
                if (!result || result.distance === Infinity) {
                    $.modal.alertError('无法找到有效路径，请检查货架布局');
                    that.routeOrder = [];
                    that.persistState();
                    return;
                }
                if (Array.isArray(result.order) && result.order.length > 0) {
                    const ordered = [];
                    result.order.forEach(orderIdx => {
                        const item = meta[orderIdx];
                        if (item) {
                            ordered.push(item.shelfId);
                        }
                    });
                    that.routeOrder = ordered;
                } else {
                    that.routeOrder = meta.map(item => item.shelfId);
                }
                that.persistState();
                $.modal.msg('路径计算完成，建议访问 ' + that.routeOrder.length + ' 个货架');
            }).catch(function(e) {
                console.error('Shelf path error:', e);
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
        markCurrentSimulation(shelfId) {
            Object.keys(this.simulationStates).forEach(key => {
                if (this.simulationStates[key] === 'current') {
                    this.$set(this.simulationStates, key, 'visited');
                }
            });
            this.$set(this.simulationStates, shelfId, 'current');
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
        simulationClass(shelfId) {
            const state = this.simulationStates[shelfId];
            if (state === 'current') {
                return 'sim-current';
            }
            if (state === 'visited') {
                return 'sim-visited';
            }
            return '';
        },
        restoreState() {
            try {
                const raw = localStorage.getItem(this.cacheKey);
                if (!raw) {
                    return;
                }
                const payload = JSON.parse(raw);
                if (payload.areaId) {
                    this.currentAreaId = payload.areaId;
                    this.currentAreaIdFromCache = payload.areaId;
                }
                if (Array.isArray(payload.selected)) {
                    this.selectedShelfIds = payload.selected;
                }
                if (Array.isArray(payload.route)) {
                    this.routeOrder = payload.route;
                }
            } catch (e) {
                console.warn('Failed to restore shelf overview cache', e);
            }
        },
        persistState() {
            try {
                const payload = {
                    areaId: this.currentAreaId,
                    selected: this.selectedShelfIds,
                    route: this.routeOrder,
                    timestamp: Date.now()
                };
                localStorage.setItem(this.cacheKey, JSON.stringify(payload));
            } catch (e) {
                console.warn('Failed to persist shelf overview cache', e);
            }
        },
        cellClass(cell) {
            const classes = ['warehouse-cell'];
            if (!cell.shelf) {
                classes.push('placeholder');
                return classes;
            }
            if (this.isShelfSelected(cell.shelf.shelfId)) {
                classes.push('is-selected');
            }
            if (this.getRouteBadge(cell.shelf.shelfId)) {
                classes.push('has-route');
            }
            const simCls = this.simulationClass(cell.shelf.shelfId);
            if (simCls) {
                classes.push(simCls);
            }
            return classes;
        },
        showCellTooltip(cell, event) {
            if (!cell || !cell.shelf) {
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
            const sizeDesc = `${cell.shelf.shelfRow || 0} × ${cell.shelf.shelfColumn || 0}`;
            this.tooltip = {
                visible: true,
                title: cell.shelf.shelfName || cell.shelf.shelfCode || '货架',
                subtitle: `编码：${cell.shelf.shelfCode || '-'}`,
                extra: `尺寸：${sizeDesc}`,
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
        initPathVisualizer() {
            if (this.pathVisualizer || typeof WarehousePathVisualizer === 'undefined') {
                return;
            }
            this.pathVisualizer = new WarehousePathVisualizer('shelfPathCanvas');
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

