var pathfindingManager = null;
var pathAnimator = null;
var selectedTargets = [];
var entryPoint = { row: 0, col: 5 };

var vueApp = new Vue({
    el: '.container-div',
    data: {
        cellList: [],
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
        routeInfo: {
            totalDistance: 0,
            visitOrder: []
        },
        isAnimating: false,
        isPaused: false,
        animationSpeed: 100
    },
    methods: {
        initPathfinding: function() {
            if (!pathfindingManager) {
                pathfindingManager = new PathfindingManager();
            }

            const canvas = document.getElementById('pathCanvas');
            if (canvas && !pathAnimator) {
                pathAnimator = new PathAnimator(canvas, pathfindingManager);
            }
        },

        togglePathMode: function() {
            this.pathMode = !this.pathMode;
            this.selectedCells = [];
            this.routeInfo = {
                totalDistance: 0,
                visitOrder: []
            };
            if (pathAnimator) {
                pathAnimator.stop();
            }
        },

        selectCell: function(row, col) {
            if (!this.pathMode) return;

            const cellIndex = this.selectedCells.findIndex(c => c.row === row && c.col === col);
            if (cellIndex >= 0) {
                this.selectedCells.splice(cellIndex, 1);
            } else {
                this.selectedCells.push({ row: row, col: col });
            }
        },

        isCellSelected: function(row, col) {
            return this.selectedCells.some(c => c.row === row && c.col === col);
        },

        calculateRoute: function() {
            const that = this;
            if (this.selectedCells.length === 0) {
                $.modal.msgWarning("请先选择目标货位");
                return;
            }

            $.modal.loading("正在计算最优路径...");

            const rowCount = Math.max(...this.cellLists.flat().map(c => c.srow));
            const colCount = Math.max(...this.cellLists.flat().map(c => c.scolumn));

            const grid = pathfindingManager.convertGridToPathfindingFormat(
                this.cellLists,
                rowCount,
                colCount
            );

            if (pathAnimator) {
                pathAnimator.setGrid(grid, rowCount, colCount);
                pathAnimator.drawGrid();
            }

            pathfindingManager.calculateOptimalPath(
                grid,
                entryPoint,
                this.selectedCells,
                function(result) {
                    $.modal.closeLoading();
                    
                    if (result.path && result.path.length > 0) {
                        that.routeInfo.totalDistance = result.totalDistance;
                        that.routeInfo.visitOrder = result.visitOrder;

                        $.modal.msgSuccess("路径计算完成！总距离: " + result.totalDistance);

                        if (pathAnimator) {
                            pathAnimator.drawGrid();
                            pathAnimator.drawPath(result.path, '#409eff', 3);
                            pathAnimator.drawMarker(entryPoint, '#67c23a', 'S');
                            
                            for (let i = 0; i < result.visitOrder.length; i++) {
                                pathAnimator.drawMarker(result.visitOrder[i], '#f56c6c', (i + 1).toString());
                            }
                        }
                    } else {
                        $.modal.msgError("无法找到有效路径");
                    }
                }
            );
        },

        startPathAnimation: function() {
            const that = this;
            if (this.selectedCells.length === 0) {
                $.modal.msgWarning("请先选择目标货位并计算路径");
                return;
            }

            if (this.isAnimating) {
                $.modal.msgWarning("动画正在播放中");
                return;
            }

            const rowCount = Math.max(...this.cellLists.flat().map(c => c.srow));
            const colCount = Math.max(...this.cellLists.flat().map(c => c.scolumn));

            const grid = pathfindingManager.convertGridToPathfindingFormat(
                this.cellLists,
                rowCount,
                colCount
            );

            pathfindingManager.calculateOptimalPath(
                grid,
                entryPoint,
                this.selectedCells,
                function(result) {
                    if (result.path && result.path.length > 0) {
                        that.isAnimating = true;
                        that.isPaused = false;
                        pathAnimator.setSpeed(that.animationSpeed);
                        pathAnimator.startAnimation(result.path, result.visitOrder);

                        const checkAnimationEnd = setInterval(function() {
                            if (!pathAnimator.isAnimating) {
                                that.isAnimating = false;
                                clearInterval(checkAnimationEnd);
                            }
                        }, 100);
                    }
                }
            );
        },

        pauseAnimation: function() {
            if (pathAnimator && this.isAnimating) {
                if (this.isPaused) {
                    pathAnimator.resume();
                    this.isPaused = false;
                } else {
                    pathAnimator.pause();
                    this.isPaused = true;
                }
            }
        },

        stopAnimation: function() {
            if (pathAnimator) {
                pathAnimator.stop();
                this.isAnimating = false;
                this.isPaused = false;
            }
        },

        setAnimationSpeed: function(speed) {
            this.animationSpeed = speed;
            if (pathAnimator) {
                pathAnimator.setSpeed(speed);
            }
        },

        clearSelection: function() {
            this.selectedCells = [];
            this.routeInfo = {
                totalDistance: 0,
                visitOrder: []
            };
            if (pathAnimator) {
                pathAnimator.stop();
            }
        },

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

                    that.$nextTick(function() {
                        that.initPathfinding();
                    });
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

        enter: function(index) {
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

        leave: function() {
            this.seen = false;
            this.current = null;
        },

        bigEnter: function(index) {
            this.bigSeen = true;
            this.bigCurrent = index;
        },

        bigLeave: function() {
            this.bigSeen = false;
            this.bigCurrent = null;
        }
    },

    created: function() {
        this.getAreas();
        this.getDoors();
    },

    mounted: function() {
        this.initPathfinding();
    }
});
