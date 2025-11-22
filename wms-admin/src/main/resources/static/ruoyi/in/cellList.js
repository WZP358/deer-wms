var billId =parseInt(localStorage.getItem(prefix+'/detail'));

var pathfindingService;

if (typeof PathfindingService !== 'undefined') {
    pathfindingService = new PathfindingService();
}

var vue = new Vue({
    el: '.container-div',

    data: {
        cellList: [
            { name: 'hw', row: 1, col: 1, have: 2, select: 1 },
            { name: 'hw', row: 1, col: 2, have: 1, select: 1 },
            { name: 'hw', row: 1, col: 3, have: 1, select: 1 },
            { name: 'hw', row: 1, col: 4, have: 1, select: 1 },
            { name: 'hw', row: 1, col: 5, have: 1, select: 1 },

        ],
        shelfStyle: {
            width: '',
            paddingBottom: ''
        },
        shelfStyle2: {
            paddingBottom: ''
        },
        contextMenu: {
            visible: false,
            title: '',
            items: [],
            style: {}
        },

        tabsFlg: 1,
        shelfIndex: '',
        cadFlg: false,

        areas:[],
        doors:[],
        cellLists:[],
        cellInfoDtos:[],
        column:0,
        style:[],
        style2:[],
        shelfs:[],
        cellNum: {
            cellNell: 0,
            cellSuccess: 0,
            cellDanger: 0,
            cellWraning: 0,
        },
        
        selectedCells: [],
        pathData: null,
        pathAnimation: {
            animating: false,
            paused: false,
            currentIndex: 0,
            intervalId: null,
            rafId: null,
            progress: 0,
            speed: 2.4,
            lastTimestamp: null,
            points: [],
            currentMarker: null
        },
        arrivalAnnotations: {},
        targetMeta: [],
        visitedTargets: {},
        entrancePosition: null,
        gridDimensions: {
            gridRows: 0,
            gridCols: 0,
            shelfRows: 0,
            shelfCols: 0
        },
        debugTag: '[CellList]'
    },
    methods: {


        logInfo: function(context, message, payload) {
            try {
                if (payload !== undefined) {
                    console.info(this.debugTag, context, message, payload);
                } else {
                    console.info(this.debugTag, context, message);
                }
            } catch (e) {}
        },

        logWarn: function(context, message, payload) {
            try {
                if (payload !== undefined) {
                    console.warn(this.debugTag, context, message, payload);
                } else {
                    console.warn(this.debugTag, context, message);
                }
            } catch (e) {}
        },

        logError: function(context, error, extra) {
            try {
                if (extra !== undefined) {
                    console.error(this.debugTag, context, error, extra);
                } else {
                    console.error(this.debugTag, context, error);
                }
            } catch (e) {}
        },

        resolveNumericValue(value) {
            var num = Number(value);
            return isNaN(num) ? 0 : num;
        },

        getRow:function(cell){
            if (!cell) {
                return 0;
            }
            if (cell.srow !== undefined && cell.srow !== null) {
                return this.resolveNumericValue(cell.srow);
            }
            if (cell.sRow !== undefined && cell.sRow !== null) {
                return this.resolveNumericValue(cell.sRow);
            }
            if (cell['s_row'] !== undefined && cell['s_row'] !== null) {
                return this.resolveNumericValue(cell['s_row']);
            }
            return 0;
        },

        getColumn:function(cell){
            if (!cell) {
                return 0;
            }
            if (cell.scolumn !== undefined && cell.scolumn !== null) {
                return this.resolveNumericValue(cell.scolumn);
            }
            if (cell.sColumn !== undefined && cell.sColumn !== null) {
                return this.resolveNumericValue(cell.sColumn);
            }
            if (cell['s_column'] !== undefined && cell['s_column'] !== null) {
                return this.resolveNumericValue(cell['s_column']);
            }
            return 0;
        },

        findCellInfoDto:function(){
            var that = this;
            $.ajax({
                cache : true,
                type : "POST",
                url :  "/system/cellInfo/findCellInfoDto",
                data : {
                    itemName:$("input[name='itemName']").val(),
                    itemCode:$("input[name='itemCode']").val(),
                    batch:$("input[name='batch']").val()

                },
                async : false,
                error : function(request) {
                    $.modal.alertError("系统错误");
                    that.logError('findCellInfoDto', '接口调用失败', {
                        status: request.status,
                        response: request.responseText
                    });
                },
                success : function(data) {
                    that.cellInfoDtos = data || [];
                    that.logInfo('findCellInfoDto', '返回记录数: ' + that.cellInfoDtos.length);
                }
            });

        },



        changeShelfBoxBackGround:function(type,index){

            var shelfBoxs = [];

            if(type == "bottom"){

                shelfBoxs = document.querySelectorAll(".shelfBox.bottom");
            }else if(type == "top"){

                shelfBoxs = document.querySelectorAll(".shelfBox.top");
            }
            if(!shelfBoxs || shelfBoxs.length === 0 || !shelfBoxs[index] || !shelfBoxs[index].children || !shelfBoxs[index].children[0]){
                return;
            }
            var shelfBoxxChilds =  shelfBoxs[index].children[0];

            // shelfBoxxChilds.style.background = "red";

        },



        getCellListByAreaId:function(areaId){

            var that = this;
            $.ajax({
                cache : true,
                type : "POST",
                url :  "/system/cellInfo/findcellList",
                data : {
                    areaId : areaId
                },
                async : false,
                error : function(request) {
                    $.modal.alertError("系统错误");
                    that.logError('getCellListByAreaId', '接口调用失败', {
                        status: request.status,
                        response: request.responseText
                    });
                },
                success : function(data) {
                    var safeList = [];
                    if (Array.isArray(data)) {
                        for (var i = 0; i < data.length; i++) {
                            var lane = data[i];
                            if (Array.isArray(lane)) {
                                var cleanedLane = [];
                                for (var j = 0; j < lane.length; j++) {
                                    if (lane[j]) {
                                        cleanedLane.push(lane[j]);
                                    }
                                }
                                if (cleanedLane.length > 0) {
                                    safeList.push(cleanedLane);
                                }
                            }
                        }
                    }
                    that.cellLists = safeList;
                    if (safeList.length === 0) {
                        that.logWarn('getCellListByAreaId', '返回的巷道数据为空，页面无法绘制');
                    } else {
                        that.logInfo('getCellListByAreaId', '成功加载巷道数据', {
                            lanes: safeList.length,
                            firstLaneCells: safeList[0] ? safeList[0].length : 0
                        });
                    }
                    var style = [];
                    var style2 = [];
                    var cellNell = 0;
                    var cellSuccess = 0;
                    var cellDanger = 0;
                    var cellWraning = 0;
                    var BASE_CELL_HEIGHT = 420;
                    var INNER_GAP = 8;
                    var MIN_CELL_HEIGHT = 18;
                    for(var laneIndex=0; laneIndex<safeList.length; laneIndex++){
                        var laneCells = safeList[laneIndex];
                        var maxColumn = 0;
                        var maxRow = 0;
                        for(var cellIndex=0; cellIndex<laneCells.length; cellIndex++){
                            var currentCell = laneCells[cellIndex];
                            var columnValue = that.getColumn(currentCell);
                            var rowValue = that.getRow(currentCell);
                            maxColumn = Math.max(maxColumn, columnValue);
                            maxRow = Math.max(maxRow, rowValue);
                            var state = Number(currentCell.state);
                            if(state === 0){
                                cellNell++;
                            }else if(state === 1){
                                cellSuccess++;
                            }else if(state === 2){
                                cellDanger++;
                            }else if(state === 3){
                                cellWraning++;
                            }
                        }
                        if (maxColumn <= 0) {
                            maxColumn = 1;
                        }
                        if (maxRow <= 0) {
                            maxRow = 1;
                        }
                        var width = (100 / maxColumn) + "%";
                        var safeRow = Math.max(maxRow, 1);
                        var computedHeight = Math.max(MIN_CELL_HEIGHT, BASE_CELL_HEIGHT / safeRow);
                        var paddingBottom = computedHeight + 'px';
                        var paddingBottom2 = Math.max(MIN_CELL_HEIGHT - 6, computedHeight - INNER_GAP) + 'px';

                        style.push({
                            width : width,
                            paddingBottom:paddingBottom
                        });
                        style2.push({
                            paddingBottom:paddingBottom2
                        });
                    }
                    that.style = style;
                    that.style2 = style2;
                    that.cellNum = {
                        cellNell: cellNell,
                        cellSuccess: cellSuccess,
                        cellDanger: cellDanger,
                        cellWraning: cellWraning,
                    };
                    that.logInfo('getCellListByAreaId', '样式数组长度', {
                        styleLength: style.length,
                        style2Length: style2.length,
                        cellListsLength: that.cellLists.length
                    });
                    that.clearPathResults();
                    that.selectedCells = [];
                    that.buildGrid();
                    that.$nextTick(function() {
                        that.logInfo('getCellListByAreaId', 'DOM已更新');
                    });
                }
            });

        },

        // getCellListByShelfId:function(shelfId){
        //
        //     var that = this;
        //     $.ajax({
        //         cache : true,
        //         type : "POST",
        //         url :  "/system/cellInfo/findcellList",
        //         data : {
        //             shelfId : shelfId
        //         },
        //         async : false,
        //         error : function(request) {
        //             $.modal.alertError("系统错误");
        //         },
        //         success : function(data) {
        //             that.cellLists = data;
        //
        //             var style = [];
        //             var style2 = [];
        //             for(var i=0;i<data.length;i++){
        //
        //                 var column = data[i][data[i].length-1].scolumn;
        //
        //                 var row = data[i][data[i].length-1].srow;
        //
        //                 var width = 100/column + "%";
        //                 var paddingBottom = 600/row + 'px';
        //                 var paddingBottom2 = (600/row)-10 + 'px';
        //
        //                 style.push({
        //
        //                     width : width,
        //                     paddingBottom:paddingBottom
        //                 });
        //                 style2.push({
        //                     paddingBottom:paddingBottom2
        //                 });
        //             }
        //             that.style = style;
        //             that.style2 = style2;
        //
        //         }
        //     });
        //
        // },
        //
        //
        // getShelfs:function(){
        //
        //     var that = this;
        //     $.ajax({
        //         cache : true,
        //         type : "POST",
        //         url :  "/system/shelfInfo/list",
        //         data : {
        //
        //         },
        //         async : false,
        //         error : function(request) {
        //             $.modal.alertError("系统错误");
        //         },
        //         success : function(data) {
        //
        //             that.shelfs = data.rows;
        //         }
        //     });
        // },




        getAreas:function(){

            var that = this;
            $.ajax({
                cache : true,
                type : "POST",
                url :  "/system/areaInfo/list",
                data : {
                    pageNum: 1,
                    pageSize: 999
                },
                async : false,
                error : function(request) {
                    $.modal.alertError("系统错误");
                    that.logError('getAreas', '接口调用失败', {
                        status: request.status,
                        response: request.responseText
                    });
                },
                success : function(data) {
                    var list = [];
                    if (data) {
                        if (Array.isArray(data.rows)) {
                            list = data.rows;
                        } else if (Array.isArray(data.data)) {
                            list = data.data;
                        } else if (Array.isArray(data)) {
                            list = data;
                        }
                    }
                    that.areas = list || [];
                    that.logInfo('getAreas', '返回货区数量: ' + that.areas.length);
                    if (that.areas.length > 0) {
                        that.getCellListByAreaId(that.areas[0].areaId);
                    } else {
                        that.logWarn('getAreas', '未获取到任何货区，页面无法展示货位。请确认基础数据。');
                    }
                }
            });

        },

        getDoors:function(){

            var that = this;
            $.ajax({
                cache : true,
                type : "POST",
                url :  "/system/door/findList",
                data : {

                },
                async : false,
                error : function(request) {
                    $.modal.alertError("系统错误");
                    that.logError('getDoors', '接口调用失败', {
                        status: request.status,
                        response: request.responseText
                    });
                },
                success : function(data) {

                    that.doors = data.rows;
                    that.logInfo('getDoors', '返回出入口数量: ' + (that.doors ? that.doors.length : 0));
                }
            });

        },


        showCellContextMenu(shelfIndex, cellIndex, cell, event) {
            if (!cell) {
                return;
            }
            const row = this.getRow(cell);
            const column = this.getColumn(cell);
            let stateText = '无筐';
            if (cell.state === 1) {
                stateText = '有筐';
            } else if (cell.state === 2) {
                stateText = '锁定';
            } else if (cell.state === 3) {
                stateText = '故障';
            }
            const items = [
                { label: '行', value: row || '-' },
                { label: '列', value: column || '-' },
                { label: '状态', value: stateText }
            ];
            this.contextMenu = {
                visible: true,
                title: '货位信息',
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
        selectShelf(type) {
            let index = this.shelfIndex
            for (let i = 0; i < this.cellList.length; i++) {
                this.cellList[i].select = 1;
            }
            if (type == 'position') {
                this.cellList[index].select = 2;
            } else if (type == 'clear') {
                this.shelfIndex = '';
            }
        },
        tranCad(){

            let cad = document.querySelector('.smallCad');
            
            if(!cad) return;

            let left = cad.style.left;
            if(this.cadFlg){
                cad.style.left = '0%';
                this.cadFlg = false
            }else{
                cad.style.left = '96%';
                this.cadFlg = true
            }

        },
        
        toggleCellSelection(shelfIndex, cellIndex) {
            const cellKey = shelfIndex + '-' + cellIndex;
            const index = this.selectedCells.indexOf(cellKey);
            if (index > -1) {
                this.selectedCells.splice(index, 1);
                console.log('取消选择货位:', cellKey);
            } else {
                this.selectedCells.push(cellKey);
                console.log('选择货位:', cellKey);
            }
            console.log('当前已选择:', this.selectedCells);
            this.clearPathResults();
        },

        buildTargetMetadata() {
            if (!this.selectedCells || this.selectedCells.length === 0) {
                return [];
            }
            const meta = [];
            for (let i = 0; i < this.selectedCells.length; i++) {
                const key = this.selectedCells[i];
                const parts = key.split('-');
                const shelfIdx = parseInt(parts[0]);
                const cellIdx = parseInt(parts[1]);
                const shelf = this.cellLists[shelfIdx];
                if (!shelf || !shelf[cellIdx]) {
                    continue;
                }
                const gridPosition = this.getCellPosition(shelfIdx, cellIdx);
                if (!gridPosition || !gridPosition.row || !gridPosition.col) {
                    continue;
                }
                meta.push({
                    key: key,
                    shelfIndex: shelfIdx,
                    cellIndex: cellIdx,
                    gridPosition: gridPosition
                });
            }
            return meta;
        },

        applyVisitOrder(order) {
            if (!order || order.length === 0) {
                this.arrivalAnnotations = {};
                return;
            }
            const annotations = {};
            order.forEach((targetIndex, seqIdx) => {
                const meta = this.targetMeta[targetIndex];
                if (!meta) {
                    return;
                }
                annotations[meta.key] = {
                    order: (seqIdx + 1).toString(),
                    reached: false,
                    position: meta.gridPosition
                };
            });
            this.arrivalAnnotations = annotations;
        },

        clearPathResults() {
            this.stopAnimation();
            this.pathData = null;
            this.arrivalAnnotations = {};
            this.targetMeta = [];
            this.resetVisitProgress(false);
            this.initCanvas();
            this.clearPathHighlight();
        },

        resetVisitProgress(markVisited = false) {
            if (!this.arrivalAnnotations) {
                return;
            }
            Object.keys(this.arrivalAnnotations).forEach(key => {
                const info = this.arrivalAnnotations[key];
                if (!info) {
                    return;
                }
                this.$set(this.arrivalAnnotations, key, Object.assign({}, info, {
                    reached: markVisited
                }));
            });
        },

        updateVisitProgress(position) {
            if (!position || !this.arrivalAnnotations) {
                return;
            }
            Object.keys(this.arrivalAnnotations).forEach(key => {
                const info = this.arrivalAnnotations[key];
                if (!info || info.reached || !info.position) {
                    return;
                }
                if (info.position.row === position.row && info.position.col === position.col) {
                    this.$set(this.arrivalAnnotations, key, Object.assign({}, info, {
                        reached: true
                    }));
                }
            });
        },

        getEntranceStyle() {
            if (!this.entrancePosition || !this.gridDimensions || this.gridDimensions.gridCols <= 1) {
                return {
                    left: 'calc(50% - 20px)',
                    top: '-30px'
                };
            }
            const colDenominator = Math.max(this.gridDimensions.gridCols - 1, 1);
            const rowDenominator = Math.max(this.gridDimensions.gridRows - 1, 1);
            const leftPercent = (this.entrancePosition.col / colDenominator) * 100;
            const topPercent = (this.entrancePosition.row / rowDenominator) * 100;
            return {
                left: `calc(${leftPercent}% - 20px)`,
                top: `calc(${topPercent}% - 32px)`
            };
        },
        
        async startPathfinding() {
            if (!pathfindingService) {
                $.modal.alertError('路径规划服务未加载');
                this.logWarn('startPathfinding', '路径规划服务未初始化');
                return;
            }
            
            if (this.selectedCells.length === 0) {
                $.modal.msg('请先选择目标货位');
                this.logWarn('startPathfinding', '未选择任何货位');
                return;
            }
            
            const grid = this.buildGrid();
            if (!grid || grid.length === 0) {
                $.modal.alertWarning('未找到可用的巷道数据');
                this.logWarn('startPathfinding', '网格构建失败，无法开始计算');
                return;
            }

            const targetMeta = this.buildTargetMetadata();
            if (targetMeta.length === 0) {
                $.modal.alertWarning('所选货位无效，请重新选择');
                this.logWarn('startPathfinding', '所选货位元数据为空');
                return;
            }

            const start = this.getEntrancePosition(grid);
            this.entrancePosition = start;
            const targets = targetMeta.map(meta => meta.gridPosition);
            this.targetMeta = targetMeta;
            const saConfig = {
                initialTemp: 800,
                coolingRate: 0.992,
                minTemp: 0.1,
                maxIterations: 20000,
                twoOptProbability: 0.45,
                stagnationLimit: 900
            };
            this.stopAnimation();
            this.clearPathHighlight();
            this.arrivalAnnotations = {};
            this.pathData = null;
            
            console.log('Grid:', grid);
            console.log('Start:', start);
            console.log('Targets:', targets);
            console.log('Grid dimensions:', grid.length, 'x', grid[0].length);
            console.log('Start position value:', grid[start.row][start.col]);
            targets.forEach((t, i) => {
                console.log('Target', i, ':', t, 'value:', grid[t.row][t.col]);
            });
            
            try {
                const result = await pathfindingService.optimizeRoute(grid, start, targets, false, saConfig);
                this.pathData = result;
                console.log('Path result:', result);
                if (result.distance === Infinity) {
                    $.modal.alertError('无法找到有效路径，请检查起点和目标点是否在通道上');
                    this.arrivalAnnotations = {};
                    this.logWarn('startPathfinding', '路径求解结果为 Infinity');
                } else {
                    this.logInfo('startPathfinding', '路径求解完成', {
                        distance: result.distance,
                        segments: result.path ? result.path.length : 0
                    });
                    const routeOrder = Array.isArray(result.order) && result.order.length > 0
                        ? result.order
                        : this.targetMeta.map((_, idx) => idx);
                    this.applyVisitOrder(routeOrder);
                    $.modal.msg('路径计算完成，总距离：' + result.distance + ' 步');
                }
            } catch (e) {
                console.error('Path error:', e);
                $.modal.alertError('路径计算失败：' + e.message);
                this.arrivalAnnotations = {};
                this.logError('startPathfinding', '路径计算异常', e);
            }
        },
        
        buildGrid() {
            if (!this.cellLists || this.cellLists.length === 0) {
                this.gridDimensions = {
                    gridRows: 0,
                    gridCols: 0,
                    shelfRows: 0,
                    shelfCols: 0
                };
                this.entrancePosition = null;
                return [];
            }
            
            let maxRow = 0;
            let maxCol = 0;
            for (let laneIndex = 0; laneIndex < this.cellLists.length; laneIndex++) {
                const lane = this.cellLists[laneIndex];
                for (let cellIndex = 0; cellIndex < lane.length; cellIndex++) {
                    const cell = lane[cellIndex];
                    maxRow = Math.max(maxRow, this.getRow(cell));
                    maxCol = Math.max(maxCol, this.getColumn(cell));
                }
            }
            if (maxRow === 0 || maxCol === 0) {
                this.gridDimensions = {
                    gridRows: 0,
                    gridCols: 0,
                    shelfRows: 0,
                    shelfCols: 0
                };
                this.entrancePosition = null;
                this.logWarn('buildGrid', '计算得到的最大行列为 0，可能是原始数据缺失');
                return [];
            }
            
            const gridRows = maxRow * 2 + 1;
            const gridCols = maxCol * 2 + 1;
            this.gridDimensions = {
                gridRows: gridRows,
                gridCols: gridCols,
                shelfRows: maxRow,
                shelfCols: maxCol
            };
            this.logInfo('buildGrid', '构建网格', this.gridDimensions);
            
            const grid = [];
            for (let r = 0; r < gridRows; r++) {
                const row = [];
                for (let c = 0; c < gridCols; c++) {
                    row.push(0);
                }
                grid.push(row);
            }
            
            for (let i = 0; i < this.cellLists.length; i++) {
                const shelfCells = this.cellLists[i];
                for (let j = 0; j < shelfCells.length; j++) {
                    const cell = shelfCells[j];
                    const rowValue = this.getRow(cell);
                    const colValue = this.getColumn(cell);
                    if (!rowValue || !colValue) {
                        continue;
                    }
                    const gridRow = (rowValue - 1) * 2 + 1;
                    const gridCol = (colValue - 1) * 2 + 1;
                    if (gridRow >= 0 && gridRow < gridRows && gridCol >= 0 && gridCol < gridCols) {
                        grid[gridRow][gridCol] = 9;
                    }
                }
            }
            
            this.entrancePosition = this.getEntrancePosition(grid);
            this.logInfo('buildGrid', '入口坐标', this.entrancePosition);
            return grid;
        },
        
        getEntrancePosition(grid) {
            if (!grid || grid.length === 0 || grid[0].length === 0) {
                return { row: 0, col: 0 };
            }
            const shelfCols = this.gridDimensions && this.gridDimensions.shelfCols
                ? this.gridDimensions.shelfCols
                : Math.floor(grid[0].length / 2);
            const middleCell = Math.max(1, Math.ceil(shelfCols / 2));
            // 使用偶数列作为入口所在通道，保证入口在“通道交叉点”（行、列均为偶数）
            const col = (middleCell - 1) * 2;
            return { row: 0, col: col };
        },
        
        getCellPosition(shelfIndex, cellIndex) {
            if (!this.cellLists[shelfIndex] || !this.cellLists[shelfIndex][cellIndex]) {
                return { row: 0, col: 0 };
            }
            const cell = this.cellLists[shelfIndex][cellIndex];
            const rowValue = this.getRow(cell);
            const colValue = this.getColumn(cell);
            if (!rowValue || !colValue) {
                return { row: 0, col: 0 };
            }
            const gridRow = (rowValue - 1) * 2 + 1;
            const gridCol = (colValue - 1) * 2 + 1;
            // 目标位置：格子正下方、左侧的通道交叉点
            // gridRow、gridCol 为奇数（格子中心），+1 / -1 后得到偶数坐标（通道）
            // 行：格子下方的通道；列：格子左侧的通道 → 行、列都为偶数
            return { row: gridRow + 1, col: gridCol - 1 };
        },
        
        startAnimation() {
            if (!this.canStartSimulation) {
                $.modal.msg('请先计算路径');
                return;
            }
            this.stopAnimation(false);
            if (!this.prepareAnimationPath()) {
                $.modal.alertWarning('无法初始化仓库平面图，请先加载货区数据');
                return;
            }
            this.resetVisitProgress(false);
            this.pathAnimation.animating = true;
            this.pathAnimation.paused = false;
            this.pathAnimation.currentIndex = 0;
            this.pathAnimation.progress = 0;
            this.pathAnimation.lastTimestamp = null;
            this.pathAnimation.currentMarker = null;
            this.pathAnimation.rafId = requestAnimationFrame(this.animateFrame);
        },
        
        initCanvas() {
            const canvas = document.getElementById('pathCanvas');
            if (!canvas) return null;
            
            const container = canvas.parentElement;
            canvas.width = container.offsetWidth;
            canvas.height = container.offsetHeight;
            
            const ctx = canvas.getContext('2d');
            ctx.clearRect(0, 0, canvas.width, canvas.height);
            return { canvas, ctx, container };
        },
        
        prepareAnimationPath() {
            if (!this.pathData || !this.pathData.path || this.pathData.path.length === 0) {
                return false;
            }
            const context = this.initCanvas();
            if (!context) {
                return false;
            }
            const { canvas, container } = context;
            const maxRow = this.gridDimensions.shelfRows;
            const maxCol = this.gridDimensions.shelfCols;
            if (!maxRow || !maxCol) {
                return false;
            }
            const cellWidth = container.offsetWidth / maxCol;
            const cellHeight = container.offsetHeight / maxRow;
            this.pathAnimation.points = this.pathData.path.map(pos => ({
                x: (pos.col / 2) * cellWidth,
                y: (pos.row / 2) * cellHeight
            }));
            this.pathAnimation.canvas = canvas;
            this.pathAnimation.cellWidth = cellWidth;
            this.pathAnimation.cellHeight = cellHeight;
            return true;
        },
        
        drawPathFrame(progress) {
            const canvas = document.getElementById('pathCanvas');
            if (!canvas) return;
            const ctx = canvas.getContext('2d');
            const points = this.pathAnimation.points;
            if (!points || points.length === 0) {
                ctx.clearRect(0, 0, canvas.width, canvas.height);
                return;
            }
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
            const maxIndex = Math.min(Math.floor(progress), points.length - 1);
            const fraction = Math.min(progress - Math.floor(progress), 1);
            ctx.beginPath();
            ctx.moveTo(startPoint.x, startPoint.y);
            for (let i = 1; i <= maxIndex; i++) {
                ctx.lineTo(points[i].x, points[i].y);
            }
            let marker = points[points.length - 1];
            if (maxIndex < points.length - 1) {
                const currentPoint = points[maxIndex];
                const nextPoint = points[maxIndex + 1];
                const interpX = currentPoint.x + (nextPoint.x - currentPoint.x) * fraction;
                const interpY = currentPoint.y + (nextPoint.y - currentPoint.y) * fraction;
                ctx.lineTo(interpX, interpY);
                marker = { x: interpX, y: interpY };
            }
            ctx.stroke();
            if (marker) {
                ctx.fillStyle = 'rgba(64, 158, 255, 0.9)';
                ctx.beginPath();
                ctx.arc(marker.x, marker.y, 7, 0, Math.PI * 2);
                ctx.fill();
                ctx.fillStyle = 'rgba(64, 158, 255, 0.25)';
                ctx.beginPath();
                ctx.arc(marker.x, marker.y, 14, 0, Math.PI * 2);
                ctx.fill();
            }
        },
        
        animateFrame(timestamp) {
            if (!this.pathAnimation.animating || !this.pathData || !this.pathData.path) {
                return;
            }
            if (this.pathAnimation.paused) {
                return;
            }
            if (!this.pathAnimation.lastTimestamp) {
                this.pathAnimation.lastTimestamp = timestamp;
                this.pathAnimation.rafId = requestAnimationFrame(this.animateFrame);
                return;
            }
            const delta = (timestamp - this.pathAnimation.lastTimestamp) / 1000;
            this.pathAnimation.lastTimestamp = timestamp;
            this.pathAnimation.progress += delta * this.pathAnimation.speed;
            const totalSegments = Math.max(this.pathData.path.length - 1, 1);
            if (this.pathAnimation.progress >= totalSegments) {
                this.pathAnimation.progress = totalSegments;
            }
            const currentIndex = Math.min(Math.floor(this.pathAnimation.progress), this.pathData.path.length - 1);
            this.pathAnimation.currentIndex = currentIndex;
            const currentPos = this.pathData.path[currentIndex];
            if (currentPos) {
                this.updateVisitProgress(currentPos);
            }
            this.drawPathFrame(this.pathAnimation.progress);
            if (this.pathAnimation.progress >= totalSegments) {
                this.pathAnimation.animating = false;
                this.pathAnimation.rafId = null;
                this.pathAnimation.lastTimestamp = null;
                this.resetVisitProgress(true);
                $.modal.msg('路径模拟完成');
                return;
            }
            this.pathAnimation.rafId = requestAnimationFrame(this.animateFrame);
        },
        
        pauseAnimation() {
            if (!this.pathAnimation.animating) {
                return;
            }
            this.pathAnimation.paused = true;
            this.cancelAnimationLoop();
        },
        
        resumeAnimation() {
            if (!this.canStartSimulation) {
                return;
            }
            this.pathAnimation.paused = false;
            this.pathAnimation.animating = true;
            this.pathAnimation.lastTimestamp = null;
            this.pathAnimation.rafId = requestAnimationFrame(this.animateFrame);
        },
        
        togglePause() {
            if (!this.canTogglePause) {
                return;
            }
            if (this.pathAnimation.paused) {
                this.resumeAnimation();
            } else {
                this.pauseAnimation();
            }
        },
        
        stopAnimation(shouldClearCanvas = true) {
            this.pathAnimation.animating = false;
            this.pathAnimation.paused = false;
            this.pathAnimation.currentIndex = 0;
            this.pathAnimation.progress = 0;
            this.pathAnimation.lastTimestamp = null;
            this.pathAnimation.currentMarker = null;
            this.pathAnimation.points = [];
            this.cancelAnimationLoop();
            if (shouldClearCanvas) {
                this.initCanvas();
            }
        },
        
        cancelAnimationLoop() {
            if (this.pathAnimation.intervalId) {
                clearTimeout(this.pathAnimation.intervalId);
                this.pathAnimation.intervalId = null;
            }
            if (this.pathAnimation.rafId) {
                cancelAnimationFrame(this.pathAnimation.rafId);
                this.pathAnimation.rafId = null;
            }
        },
        
        highlightPath(pos) {
            const elements = document.querySelectorAll('.path-highlight');
            for (let i = 0; i < elements.length; i++) {
                elements[i].classList.remove('path-current');
            }
            
            if (pos.row % 2 === 0 && pos.col % 2 === 0) {
                return;
            }
            
            let shelfRow = Math.floor((pos.row - 1) / 2) + 1;
            let shelfCol = Math.floor((pos.col - 1) / 2) + 1;
            if (shelfRow < 1 || shelfCol < 1) {
                return;
            }
            
            const selector = '.shelf[data-row="' + shelfRow + '"][data-col="' + shelfCol + '"]';
            const element = document.querySelector(selector);
            if (element) {
                element.classList.add('path-highlight', 'path-current');
            }
        },
        
        clearPathHighlight() {
            const elements = document.querySelectorAll('.path-highlight');
            for (let i = 0; i < elements.length; i++) {
                elements[i].classList.remove('path-highlight', 'path-current');
            }
        }

    },
    computed: {
        entranceDisplayName() {
            if (this.doors && this.doors.length > 0) {
                return this.doors.map(item => item.name || item.doorName || '大门').join(' / ');
            }
            return '大门';
        },
        canStartSimulation() {
            return !!(this.pathData && Array.isArray(this.pathData.path) && this.pathData.path.length > 1);
        },
        canTogglePause() {
            if (!this.canStartSimulation) {
                return false;
            }
            if (this.pathAnimation.animating) {
                return true;
            }
            return this.pathAnimation.paused;
        },
        canStopSimulation() {
            return this.pathAnimation.animating || this.pathAnimation.currentIndex > 0;
        },
        pathStatusText() {
            if (!this.pathData || !this.pathData.path) {
                return '尚未生成路径';
            }
            if (this.pathAnimation.animating && !this.pathAnimation.paused) {
                return '路径模拟中';
            }
            if (this.pathAnimation.paused) {
                return '模拟已暂停';
            }
            if (!this.pathAnimation.animating && this.pathAnimation.currentIndex > 0) {
                return '模拟完成';
            }
            return '路径已生成，可开始模拟';
        }
    },
    created: function () {
        this.getAreas();
        this.getDoors();
    },
    mounted: function () {
        document.addEventListener('click', this.hideContextMenu.bind(this));
        setTimeout(this.tranCad,1000);
        setInterval(this.tranCad,20000);
    },

    updated:function(){
        this.changeShelfBoxBackGround("top",0);
        this.changeShelfBoxBackGround("bottom",1);
    },

})