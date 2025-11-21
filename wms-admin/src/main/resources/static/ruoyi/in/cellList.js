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

        areas:[],
        doors:[],
        cellLists:[],
        cellInfoDtos:[],
        column:0,
        style:[],
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
            intervalId: null
        }
    },
    methods: {


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
                },
                success : function(data) {
                    that.cellInfoDtos = data;
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
                },
                success : function(data) {
                    debugger
                    that.cellLists = data;
                    var style = [];
                    var style2 = [];
                    var cellNell = 0;
                    var cellSuccess = 0;
                    var cellDanger = 0;
                    var cellWraning = 0;
                    for(var i=0;i<data.length;i++){

                        var column = data[i][data[i].length-1].scolumn;

                        var row = data[i][data[i].length-1].srow;

                        var width = 100/column + "%";
                        var paddingBottom = 600/row + 'px';
                        var paddingBottom2 = (600/row)-10 + 'px';

                        for(let j=0;j<data[i].length;j++){
                            if(data[i][j].state === 0){
                                cellNell++;
                            }else if(data[i][j].state === 1){
                                cellSuccess++;
                            }else if(data[i][j].state === 2){
                                cellDanger++;
                            }else if(data[i][j].state === 3){
                                cellWraning++;
                            }
                        }

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

                },
                async : false,
                error : function(request) {
                    $.modal.alertError("系统错误");
                },
                success : function(data) {

                    that.areas = data.rows;
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
                },
                success : function(data) {

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
            this.nowShowConten.row = this.cellLists[0][this.cellLists[0].length-1].srow+1-cell.srow;
            this.nowShowConten.column = cell.scolumn;
            if(cell.state === 0){
                this.nowShowConten.state = '无筐';
            }else if(cell.state === 1){
                this.nowShowConten.state = '有筐';
            }else if(cell.state === 2){
                this.nowShowConten.state = '锁定';
            }else if(cell.state === 3){
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
        },
        
        async startPathfinding() {
            if (!pathfindingService) {
                $.modal.alertError('路径规划服务未加载');
                return;
            }
            
            if (this.selectedCells.length === 0) {
                $.modal.msg('请先选择目标货位');
                return;
            }
            
            const grid = this.buildGrid();
            const start = this.getEntrancePosition(grid);
            const targets = this.selectedCells.map(key => {
                const parts = key.split('-');
                const shelfIdx = parseInt(parts[0]);
                const cellIdx = parseInt(parts[1]);
                return this.getCellPosition(shelfIdx, cellIdx);
            });
            
            console.log('Grid:', grid);
            console.log('Start:', start);
            console.log('Targets:', targets);
            console.log('Grid dimensions:', grid.length, 'x', grid[0].length);
            console.log('Start position value:', grid[start.row][start.col]);
            targets.forEach((t, i) => {
                console.log('Target', i, ':', t, 'value:', grid[t.row][t.col]);
            });
            
            try {
                const result = await pathfindingService.optimizeRoute(grid, start, targets, false);
                this.pathData = result;
                console.log('Path result:', result);
                if (result.distance === Infinity) {
                    $.modal.alertError('无法找到有效路径，请检查起点和目标点是否在通道上');
                } else {
                    $.modal.msg('路径计算完成，总距离：' + result.distance + ' 步');
                }
            } catch (e) {
                console.error('Path error:', e);
                $.modal.alertError('路径计算失败：' + e.message);
            }
        },
        
        buildGrid() {
            if (!this.cellLists || this.cellLists.length === 0) {
                return [];
            }
            
            const shelf = this.cellLists[0];
            if (!shelf || shelf.length === 0) return [];
            
            const maxRow = shelf[shelf.length - 1].srow;
            const maxCol = shelf[shelf.length - 1].scolumn;
            
            const gridRows = maxRow * 2 + 1;
            const gridCols = maxCol * 2 + 1;
            
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
                    const gridRow = (cell.srow - 1) * 2 + 1;
                    const gridCol = (cell.scolumn - 1) * 2 + 1;
                    if (gridRow >= 0 && gridRow < gridRows && gridCol >= 0 && gridCol < gridCols) {
                        grid[gridRow][gridCol] = 9;
                    }
                }
            }
            
            return grid;
        },
        
        getEntrancePosition(grid) {
            if (!grid || grid.length === 0 || grid[0].length === 0) {
                return { row: 0, col: 0 };
            }
            
            const middleCol = Math.floor(grid[0].length / 2);
            return { row: 0, col: middleCol };
        },
        
        getCellPosition(shelfIndex, cellIndex) {
            const cell = this.cellLists[shelfIndex][cellIndex];
            const gridRow = (cell.srow - 1) * 2 + 1;
            const gridCol = (cell.scolumn - 1) * 2 + 1;
            return { row: gridRow + 1, col: gridCol };
        },
        
        startAnimation() {
            if (!this.pathData || !this.pathData.path) {
                $.modal.msg('请先计算路径');
                return;
            }
            
            this.pathAnimation.animating = true;
            this.pathAnimation.paused = false;
            this.pathAnimation.currentIndex = 0;
            
            this.initCanvas();
            this.animateStep();
        },
        
        initCanvas() {
            const canvas = document.getElementById('pathCanvas');
            if (!canvas) return;
            
            const container = canvas.parentElement;
            canvas.width = container.offsetWidth;
            canvas.height = container.offsetHeight;
            
            const ctx = canvas.getContext('2d');
            ctx.clearRect(0, 0, canvas.width, canvas.height);
        },
        
        drawPath(currentIndex) {
            const canvas = document.getElementById('pathCanvas');
            if (!canvas) return;
            
            const ctx = canvas.getContext('2d');
            const container = canvas.parentElement;
            
            ctx.clearRect(0, 0, canvas.width, canvas.height);
            
            if (!this.pathData || !this.pathData.path || this.pathData.path.length === 0) return;
            
            const shelf = this.cellLists[0];
            if (!shelf || shelf.length === 0) return;
            
            const maxRow = shelf[shelf.length - 1].srow;
            const maxCol = shelf[shelf.length - 1].scolumn;
            
            const cellWidth = container.offsetWidth / maxCol;
            const cellHeight = container.offsetHeight / maxRow;
            
            ctx.strokeStyle = '#ff0000';
            ctx.lineWidth = 3;
            ctx.lineCap = 'round';
            ctx.lineJoin = 'round';
            
            ctx.beginPath();
            
            for (let i = 0; i <= currentIndex && i < this.pathData.path.length; i++) {
                const pos = this.pathData.path[i];
                const x = (pos.col / 2) * cellWidth;
                const y = (pos.row / 2) * cellHeight;
                
                if (i === 0) {
                    ctx.moveTo(x, y);
                } else {
                    ctx.lineTo(x, y);
                }
            }
            
            ctx.stroke();
            
            if (currentIndex < this.pathData.path.length) {
                const pos = this.pathData.path[currentIndex];
                const x = (pos.col / 2) * cellWidth;
                const y = (pos.row / 2) * cellHeight;
                
                ctx.fillStyle = '#409eff';
                ctx.beginPath();
                ctx.arc(x, y, 8, 0, Math.PI * 2);
                ctx.fill();
            }
        },
        
        animateStep() {
            const that = this;
            if (that.pathAnimation.paused || !that.pathAnimation.animating) {
                return;
            }
            
            if (that.pathAnimation.currentIndex >= that.pathData.path.length) {
                that.pathAnimation.animating = false;
                $.modal.msg('路径模拟完成');
                return;
            }
            
            that.drawPath(that.pathAnimation.currentIndex);
            that.pathAnimation.currentIndex++;
            
            that.pathAnimation.intervalId = setTimeout(function() {
                that.animateStep();
            }, 200);
        },
        
        pauseAnimation() {
            this.pathAnimation.paused = true;
            if (this.pathAnimation.intervalId) {
                clearTimeout(this.pathAnimation.intervalId);
            }
        },
        
        resumeAnimation() {
            this.pathAnimation.paused = false;
            this.animateStep();
        },
        
        stopAnimation() {
            this.pathAnimation.animating = false;
            this.pathAnimation.paused = false;
            this.pathAnimation.currentIndex = 0;
            if (this.pathAnimation.intervalId) {
                clearTimeout(this.pathAnimation.intervalId);
            }
            this.initCanvas();
        },
        
        highlightPath(pos) {
            const elements = document.querySelectorAll('.path-highlight');
            for (let i = 0; i < elements.length; i++) {
                elements[i].classList.remove('path-current');
            }
            
            if (pos.row % 2 === 0 && pos.col % 2 === 0) {
                return;
            }
            
            let shelfRow = Math.floor(pos.row / 2) + 1;
            let shelfCol = Math.floor(pos.col / 2) + 1;
            
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
    created: function () {
        this.getAreas();
        this.getDoors();
    },

    updated:function(){
        this.changeShelfBoxBackGround("top",0);
        this.changeShelfBoxBackGround("bottom",1);
    },
    mounted: function () {
        setTimeout(this.tranCad,1000);
        setInterval(this.tranCad,20000);


    },

})