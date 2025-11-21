var billId = parseInt(localStorage.getItem(prefix + '/detail'));

var pathfindingManager = null;
var pathAnimator = null;

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
        seen: false,
        current: 0,

        nowShowConten: {
            row: null,
            column: null,
            state: null,
        },

        bigSeen: false,
        bigCurrent: 0,

        tabsFlg: 1,
        shelfIndex: '',
        cadFlg: false,

        areas: [],
        doors: [],
        cellLists: [],
        cellInfoDtos: [],
        column: 0,
        style: [],
        shelfs: [],
        cellNum: {
            cellNell: 0,
            cellSuccess: 0,
            cellDanger: 0,
            cellWraning: 0,
        },

        pathMode: false,
        selectedCells: [],
        calculatedPath: [],
        visitOrder: [],
        routeInfo: {
            totalDistance: 0,
            estimatedTime: 0
        },
        isAnimating: false,
        isPaused: false,
        animationSpeed: 200,
        currentPathPosition: null,
        pathOverlay: []
    },
    methods: {

        findCellInfoDto: function() {
            var that = this;
            $.ajax({
                cache: true,
                type: "POST",
                url: "/system/cellInfo/findCellInfoDto",
                data: {
                    itemName: $("input[name='itemName']").val(),
                    itemCode: $("input[name='itemCode']").val(),
                    batch: $("input[name='batch']").val()
                },
                async: false,
                error: function(request) {
                    $.modal.alertError("系统错误");
                },
                success: function(data) {
                    that.cellInfoDtos = data;
                }
            });
        },

        changeShelfBoxBackGround: function(type, index) {
            var shelfBoxs = [];

            if (type == "bottom") {
                shelfBoxs = document.querySelectorAll(".shelfBox.bottom");
            } else if (type == "top") {
                shelfBoxs = document.querySelectorAll(".shelfBox.top");
            }
            var shelfBoxxChilds = shelfBoxs[index].children[0];
        },

        getCellListByAreaId: function(areaId) {
            var that = this;
            $.ajax({
                cache: true,
                type: "POST",
                url: "/system/cellInfo/findcellList",
                data: {
                    areaId: areaId
                },
                async: false,
                error: function(request) {
                    $.modal.alertError("系统错误");
                },
                success: function(data) {
                    that.cellLists = data;
                    var style = [];
                    var style2 = [];
                    var cellNell = 0;
                    var cellSuccess = 0;
                    var cellDanger = 0;
                    var cellWraning = 0;
                    for (var i = 0; i < data.length; i++) {
                        var column = data[i][data[i].length - 1].scolumn;
                        var row = data[i][data[i].length - 1].srow;

                        var width = 100 / column + "%";
                        var paddingBottom = 600 / row + 'px';
                        var paddingBottom2 = (600 / row) - 10 + 'px';

                        for (let j = 0; j < data[i].length; j++) {
                            if (data[i][j].state === 0) {
                                cellNell++;
                            } else if (data[i][j].state === 1) {
                                cellSuccess++;
                            } else if (data[i][j].state === 2) {
                                cellDanger++;
                            } else if (data[i][j].state === 3) {
                                cellWraning++;
                            }
                        }

                        style.push({
                            width: width,
                            paddingBottom: paddingBottom
                        });
                        style2.push({
                            paddingBottom: paddingBottom2
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
                }
            });
        },

        getAreas: function() {
            var that = this;
            $.ajax({
                cache: true,
                type: "POST",
                url: "/system/areaInfo/list",
                data: {},
                async: false,
                error: function(request) {
                    $.modal.alertError("系统错误");
                },
                success: function(data) {
                    that.areas = data.rows;
                }
            });
        },

        getDoors: function() {
            var that = this;
            $.ajax({
                cache: true,
                type: "POST",
                url: "/system/door/findList",
                data: {},
                async: false,
                error: function(request) {
                    $.modal.alertError("系统错误");
                },
                success: function(data) {
                    that.doors = data.rows;
                }
            });
        },

        bigEnter(index) {
            this.bigSeen = true;
            this.bigCurrent = index;
        },
        bigLeave() {
            this.bigSeen = false;
            this.bigCurrent = null;
        },

        enter(index) {
            let cell = this.cellLists[0][index];
            this.nowShowConten.row = this.cellLists[0][this.cellLists[0].length - 1].srow + 1 - cell.srow;
            this.nowShowConten.column = cell.scolumn;
            if (cell.state === 0) {
                this.nowShowConten.state = '无筐';
            } else if (cell.state === 1) {
                this.nowShowConten.state = '有筐';
            } else if (cell.state === 2) {
                this.nowShowConten.state = '锁定';
            } else if (cell.state === 3) {
                this.nowShowConten.state = '故障';
            }

            this.seen = true;
            this.current = index;
        },
        leave() {
            this.seen = false;
            this.current = null;
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
        tranCad() {
            let cad = document.querySelector('.smallCad');
            let left = cad.style.left;
            if (this.cadFlg) {
                cad.style.left = '0%';
                this.cadFlg = false
            } else {
                cad.style.left = '96%';
                this.cadFlg = true
            }
        },

        togglePathMode() {
            this.pathMode = !this.pathMode;
            if (!this.pathMode) {
                this.selectedCells = [];
                this.clearPathOverlay();
            }
        },

        onCellClick(cell, shelfIndex, cellIndex) {
            if (!this.pathMode) return;

            if (cell.state === 2 || cell.state === 3) {
                $.modal.alertWarning('该货位不可选择');
                return;
            }

            const cellPos = { row: cell.srow, col: cell.scolumn };
            const existingIndex = this.selectedCells.findIndex(
                c => c.row === cellPos.row && c.col === cellPos.col
            );

            if (existingIndex >= 0) {
                this.selectedCells.splice(existingIndex, 1);
            } else {
                this.selectedCells.push(cellPos);
            }

            this.updateCellSelection();
        },

        updateCellSelection() {
            this.$forceUpdate();
        },

        isCellSelected(cell) {
            return this.selectedCells.some(
                c => c.row === cell.srow && c.col === cell.scolumn
            );
        },

        calculateRoute() {
            if (this.selectedCells.length === 0) {
                $.modal.alertWarning('请先选择目标货位');
                return;
            }

            $.modal.loading("正在计算最优路径...");

            const gridData = this.buildGridData();
            const entryPoint = this.getEntryPoint();

            pathfindingManager.calculateOptimalPath(
                gridData,
                entryPoint,
                this.selectedCells,
                (result) => {
                    $.modal.closeLoading();

                    if (result.success) {
                        this.calculatedPath = result.path;
                        this.visitOrder = result.visitOrder;
                        this.routeInfo.totalDistance = result.totalDistance;
                        this.routeInfo.estimatedTime = Math.ceil(result.totalDistance * 2 / 60);

                        $.modal.msgSuccess(
                            `路径计算成功!\n总距离: ${result.totalDistance}格\n预计耗时: ${this.routeInfo.estimatedTime}分钟`
                        );

                        this.renderPathOverlay();
                    } else {
                        $.modal.alertError('路径计算失败: ' + result.error);
                    }
                },
                {
                    initialTemp: 10000,
                    coolingRate: 0.995,
                    minTemp: 1,
                    maxIterations: 30000
                }
            );
        },

        buildGridData() {
            const grid = [];
            if (this.cellLists.length === 0) return grid;

            const maxRow = Math.max(...this.cellLists.flat().map(c => c.srow));
            const maxCol = Math.max(...this.cellLists.flat().map(c => c.scolumn));

            for (let r = 0; r <= maxRow; r++) {
                grid[r] = [];
                for (let c = 0; c <= maxCol; c++) {
                    const cell = this.cellLists.flat().find(
                        cell => cell.srow === r && cell.scolumn === c
                    );
                    grid[r][c] = cell || { state: 0 };
                }
            }

            return grid;
        },

        getEntryPoint() {
            if (this.cellLists.length > 0 && this.cellLists[0].length > 0) {
                const firstShelf = this.cellLists[0];
                const maxCol = firstShelf[firstShelf.length - 1].scolumn;
                const middleCol = Math.floor(maxCol / 2);
                return { row: 0, col: middleCol };
            }
            return { row: 0, col: 0 };
        },

        renderPathOverlay() {
            this.pathOverlay = [];
            this.calculatedPath.forEach((point, index) => {
                this.pathOverlay.push({
                    row: point.row,
                    col: point.col,
                    index: index
                });
            });
        },

        clearPathOverlay() {
            this.pathOverlay = [];
            this.calculatedPath = [];
            this.visitOrder = [];
            this.currentPathPosition = null;
        },

        startPathAnimation() {
            if (this.calculatedPath.length === 0) {
                $.modal.alertWarning('请先计算路径');
                return;
            }

            this.isAnimating = true;
            this.isPaused = false;

            pathAnimator.setPath(this.calculatedPath, this.visitOrder);
            pathAnimator.setSpeed(this.animationSpeed);
            pathAnimator.setCallbacks(
                (current, index, visitIndex) => {
                    this.currentPathPosition = current;
                    this.$forceUpdate();
                },
                () => {
                    this.isAnimating = false;
                    this.currentPathPosition = null;
                    $.modal.msgSuccess('路径模拟完成!');
                }
            );

            pathAnimator.start();
        },

        pauseAnimation() {
            if (!this.isAnimating) return;

            if (this.isPaused) {
                pathAnimator.resume();
                this.isPaused = false;
            } else {
                pathAnimator.pause();
                this.isPaused = true;
            }
        },

        stopAnimation() {
            pathAnimator.stop();
            this.isAnimating = false;
            this.isPaused = false;
            this.currentPathPosition = null;
        },

        setAnimationSpeed(speed) {
            pathAnimator.setSpeed(parseInt(speed));
        },

        isCurrentPosition(cell) {
            return this.currentPathPosition &&
                this.currentPathPosition.row === cell.srow &&
                this.currentPathPosition.col === cell.scolumn;
        },

        isInPath(cell) {
            return this.pathOverlay.some(
                p => p.row === cell.srow && p.col === cell.scolumn
            );
        },

        getPathIndex(cell) {
            const visitIndex = this.visitOrder.findIndex(
                v => v.row === cell.srow && v.col === cell.scolumn
            );
            return visitIndex >= 0 ? visitIndex + 1 : null;
        },

        clearSelection() {
            this.selectedCells = [];
            this.clearPathOverlay();
            this.pathMode = false;
        }
    },

    created: function() {
        this.getAreas();
        this.getDoors();

        pathfindingManager = new PathfindingManager();
        pathAnimator = new PathAnimator('.container-div');
    },

    updated: function() {
        this.changeShelfBoxBackGround("top", 0);
        this.changeShelfBoxBackGround("bottom", 1);
    },

    mounted: function() {
        setTimeout(this.tranCad, 1000);
        setInterval(this.tranCad, 20000);
    },

    beforeDestroy: function() {
        if (pathfindingManager) {
            pathfindingManager.terminate();
        }
        if (pathAnimator) {
            pathAnimator.stop();
        }
    }
})
