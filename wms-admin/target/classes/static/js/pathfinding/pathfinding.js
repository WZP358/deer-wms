class PathfindingService {
    constructor() {
        this.worker = null;
        this.initWorker();
    }
    
    initWorker() {
        try {
            this.worker = new Worker('/js/pathfinding/pathfinding-worker.js');
        } catch (e) {
            console.warn('Web Worker not supported, using synchronous mode');
        }
    }
    
    async findPath(grid, start, end, allowDiagonal = false) {
        if (this.worker) {
            return new Promise((resolve) => {
                this.worker.onmessage = (e) => {
                    if (e.data.type === 'pathResult') {
                        resolve(e.data.path);
                    }
                };
                this.worker.postMessage({
                    type: 'findPath',
                    data: { grid, start, end, allowDiagonal }
                });
            });
        } else {
            return this.findPathSync(grid, start, end, allowDiagonal);
        }
    }
    
    async optimizeRoute(grid, start, targets, allowDiagonal = false, saParams = {}) {
        if (this.worker) {
            return new Promise((resolve) => {
                this.worker.onmessage = (e) => {
                    if (e.data.type === 'routeResult') {
                        resolve(e.data.result);
                    }
                };
                this.worker.postMessage({
                    type: 'optimizeRoute',
                    data: { grid, start, targets, allowDiagonal, saParams }
                });
            });
        } else {
            return this.optimizeRouteSync(grid, start, targets, allowDiagonal, saParams);
        }
    }
    
    findPathSync(grid, start, end, allowDiagonal = false) {
        const rows = grid.length;
        const cols = grid[0].length;
        
        const isValid = (row, col) => {
            return row >= 0 && row < rows && col >= 0 && col < cols;
        };
        
        const isWalkable = (row, col) => {
            if (!isValid(row, col)) return false;
            const state = grid[row][col];
            return state === 0;
        };
        
        const queue = [[start.row, start.col, [start]]];
        const visited = new Set();
        visited.add(`${start.row},${start.col}`);
        
        const directions = [
            [-1, 0], [1, 0], [0, -1], [0, 1]
        ];
        
        if (allowDiagonal) {
            directions.push([-1, -1], [-1, 1], [1, -1], [1, 1]);
        }
        
        while (queue.length > 0) {
            const [row, col, path] = queue.shift();
            
            if (row === end.row && col === end.col) {
                return path;
            }
            
            for (const [dr, dc] of directions) {
                const newRow = row + dr;
                const newCol = col + dc;
                const key = `${newRow},${newCol}`;
                
                if (isWalkable(newRow, newCol) && !visited.has(key)) {
                    visited.add(key);
                    queue.push([newRow, newCol, [...path, {row: newRow, col: newCol}]]);
                }
            }
        }
        
        return null;
    }
    
    optimizeRouteSync(grid, start, targets, allowDiagonal = false, saParams = {}) {
        const config = this.normalizeSaParams(saParams);
        
        if (!targets || targets.length === 0) {
            return { path: [start], distance: 0, order: [] };
        }

        if (targets.length === 1) {
            const path = this.findPathSync(grid, start, targets[0], allowDiagonal);
            return { 
                path: path || [start], 
                distance: path ? path.length - 1 : Infinity,
                order: [0]
            };
        }
        
        const distanceMatrix = this.buildDistanceMatrix(grid, start, targets, allowDiagonal);
        
        let currentOrder = this.buildInitialOrder(distanceMatrix, targets.length);
        if (currentOrder.length === 0) {
            currentOrder = targets.map((_, i) => i);
        }

        let currentDistance = this.calculateOrderDistance(currentOrder, distanceMatrix);
        let bestOrder = [...currentOrder];
        let bestDistance = currentDistance;
        
        let temp = config.initialTemp;
        let iterations = 0;
        let stagnationCounter = 0;
        
        while (temp > config.minTemp && iterations < config.maxIterations) {
            const newOrder = this.generateNeighborOrder(currentOrder, config.twoOptProbability);
            const newDistance = this.calculateOrderDistance(newOrder, distanceMatrix);
            
            const delta = newDistance - currentDistance;
            
            if (delta < 0 || Math.random() < Math.exp(-delta / Math.max(temp, 1e-9))) {
                currentOrder = newOrder;
                currentDistance = newDistance;
                
                if (currentDistance < bestDistance) {
                    bestOrder = [...currentOrder];
                    bestDistance = currentDistance;
                    stagnationCounter = 0;
                } else {
                    stagnationCounter++;
                }
            } else {
                stagnationCounter++;
            }
            
            if (stagnationCounter > config.stagnationLimit) {
                currentOrder = this.localRefinement(currentOrder, distanceMatrix);
                currentDistance = this.calculateOrderDistance(currentOrder, distanceMatrix);
                stagnationCounter = 0;
                temp *= 0.9;
                continue;
            }
            
            temp *= config.coolingRate;
            iterations++;
        }

        if (stagnationCounter > 0) {
            const refined = this.localRefinement(bestOrder, distanceMatrix);
            const refinedDistance = this.calculateOrderDistance(refined, distanceMatrix);
            if (refinedDistance < bestDistance) {
                bestOrder = refined;
                bestDistance = refinedDistance;
            }
        }
        
        const fullPath = this.buildFullPath(grid, start, bestOrder.map(i => targets[i]), allowDiagonal);
        
        return {
            path: fullPath,
            distance: bestDistance,
            order: bestOrder
        };
    }
    
    buildDistanceMatrix(grid, start, targets, allowDiagonal) {
        const points = [start, ...targets];
        const n = points.length;
        const matrix = Array(n).fill(null).map(() => Array(n).fill(Infinity));
        
        for (let i = 0; i < n; i++) {
            matrix[i][i] = 0;
            for (let j = i + 1; j < n; j++) {
                const path = this.findPathSync(grid, points[i], points[j], allowDiagonal);
                const dist = path ? path.length - 1 : Infinity;
                matrix[i][j] = dist;
                matrix[j][i] = dist;
            }
        }
        
        return matrix;
    }
    
    calculateOrderDistance(order, distanceMatrix) {
        if (!order || order.length === 0) {
            return 0;
        }
        let total = distanceMatrix[0][order[0] + 1];
        
        for (let i = 0; i < order.length - 1; i++) {
            total += distanceMatrix[order[i] + 1][order[i + 1] + 1];
        }
        
        return total;
    }
    
    buildInitialOrder(distanceMatrix, targetCount) {
        const order = [];
        const remaining = [];
        for (let i = 0; i < targetCount; i++) {
            remaining.push(i);
        }

        let currentIndex = 0;
        while (remaining.length > 0) {
            let bestIdx = 0;
            let bestDistance = Infinity;

            for (let i = 0; i < remaining.length; i++) {
                const candidate = remaining[i];
                const distance = distanceMatrix[currentIndex][candidate + 1];
                if (distance < bestDistance) {
                    bestDistance = distance;
                    bestIdx = i;
                }
            }

            const [nextTarget] = remaining.splice(bestIdx, 1);
            order.push(nextTarget);
            currentIndex = nextTarget + 1;
        }

        return order;
    }

    generateNeighborOrder(order, twoOptProbability) {
        if (order.length < 3 || Math.random() > twoOptProbability) {
            const newOrder = [...order];
            const i = Math.floor(Math.random() * newOrder.length);
            const j = Math.floor(Math.random() * newOrder.length);
            [newOrder[i], newOrder[j]] = [newOrder[j], newOrder[i]];
            return newOrder;
        }

        const i = Math.floor(Math.random() * (order.length - 1));
        const j = i + 1 + Math.floor(Math.random() * (order.length - i - 1));
        return this.twoOptSwap(order, i, j);
    }

    twoOptSwap(order, i, k) {
        const newOrder = [...order];
        let start = i;
        let end = k;
        while (start < end) {
            [newOrder[start], newOrder[end]] = [newOrder[end], newOrder[start]];
            start++;
            end--;
        }
        return newOrder;
    }

    localRefinement(order, distanceMatrix) {
        if (!order || order.length < 4) {
            return [...order];
        }

        let bestOrder = [...order];
        let improved = true;

        while (improved) {
            improved = false;
            for (let i = 0; i < bestOrder.length - 2; i++) {
                for (let j = i + 1; j < bestOrder.length - 1; j++) {
                    const candidate = this.twoOptSwap(bestOrder, i, j);
                    if (this.calculateOrderDistance(candidate, distanceMatrix) < this.calculateOrderDistance(bestOrder, distanceMatrix)) {
                        bestOrder = candidate;
                        improved = true;
                        break;
                    }
                }
                if (improved) {
                    break;
                }
            }
        }

        return bestOrder;
    }

    normalizeSaParams(saParams = {}) {
        return {
            initialTemp: saParams.initialTemp || 800,
            coolingRate: saParams.coolingRate || 0.992,
            minTemp: saParams.minTemp || 0.1,
            maxIterations: saParams.maxIterations || 20000,
            twoOptProbability: saParams.twoOptProbability || 0.4,
            stagnationLimit: saParams.stagnationLimit || 800
        };
    }
    
    buildFullPath(grid, start, orderedTargets, allowDiagonal) {
        let fullPath = [start];
        let current = start;
        
        for (const target of orderedTargets) {
            const segment = this.findPathSync(grid, current, target, allowDiagonal);
            if (segment && segment.length > 1) {
                fullPath = fullPath.concat(segment.slice(1));
                current = target;
            }
        }
        
        // 添加从最后一个目标返回起点的路径
        if (orderedTargets.length > 0) {
            const returnSegment = this.findPathSync(grid, current, start, allowDiagonal);
            if (returnSegment && returnSegment.length > 1) {
                fullPath = fullPath.concat(returnSegment.slice(1));
            }
        }

        // 为了避免“路径穿模”，这里对整条路径做一次压缩：
        // 仅保留通道交叉点（行、列都是偶数的坐标），这样前端在绘制时，
        // 无论是 areaOverview/shelfOverview 自己画，还是 WarehousePathVisualizer，
        // 都只会在格子之间的通道中心线上画线，不会从格子中间穿过去。
        const compressed = [];
        for (let i = 0; i < fullPath.length; i++) {
            const p = fullPath[i];
            if (!p || typeof p.row !== 'number' || typeof p.col !== 'number') {
                continue;
            }
            const isEndpoint = (i === 0 || i === fullPath.length - 1);
            const isEvenEven = (p.row % 2 === 0) && (p.col % 2 === 0);

            // 起点/终点和所有“通道交叉点”都会被保留；
            // 其它中间点（奇数行 / 奇数列）只用于内部寻路，不参与可视化，避免穿模视觉效果。
            if (isEndpoint || isEvenEven) {
                const last = compressed[compressed.length - 1];
                if (!last || last.row !== p.row || last.col !== p.col) {
                    compressed.push({ row: p.row, col: p.col });
                }
            }
        }

        // 正常情况下 compressed 至少有两个点；如果异常情况导致只有一个点，就退回原始路径。
        return compressed.length >= 2 ? compressed : fullPath;
    }
}
