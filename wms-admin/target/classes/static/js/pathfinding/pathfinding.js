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
        const {
            initialTemp = 1000,
            coolingRate = 0.995,
            minTemp = 1,
            maxIterations = 5000
        } = saParams;
        
        if (targets.length === 0) return { path: [start], distance: 0, order: [] };
        if (targets.length === 1) {
            const path = this.findPathSync(grid, start, targets[0], allowDiagonal);
            return { 
                path: path || [start], 
                distance: path ? path.length - 1 : 0,
                order: [0]
            };
        }
        
        const distanceMatrix = this.buildDistanceMatrix(grid, start, targets, allowDiagonal);
        
        let currentOrder = targets.map((_, i) => i);
        let currentDistance = this.calculateTotalDistance(currentOrder, distanceMatrix);
        let bestOrder = [...currentOrder];
        let bestDistance = currentDistance;
        
        let temp = initialTemp;
        let iterations = 0;
        
        while (temp > minTemp && iterations < maxIterations) {
            const newOrder = this.mutateOrder(currentOrder);
            const newDistance = this.calculateTotalDistance(newOrder, distanceMatrix);
            
            const delta = newDistance - currentDistance;
            
            if (delta < 0 || Math.random() < Math.exp(-delta / temp)) {
                currentOrder = newOrder;
                currentDistance = newDistance;
                
                if (currentDistance < bestDistance) {
                    bestOrder = [...currentOrder];
                    bestDistance = currentDistance;
                }
            }
            
            temp *= coolingRate;
            iterations++;
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
    
    calculateTotalDistance(order, distanceMatrix) {
        let total = distanceMatrix[0][order[0] + 1];
        
        for (let i = 0; i < order.length - 1; i++) {
            total += distanceMatrix[order[i] + 1][order[i + 1] + 1];
        }
        
        return total;
    }
    
    mutateOrder(order) {
        const newOrder = [...order];
        const i = Math.floor(Math.random() * newOrder.length);
        const j = Math.floor(Math.random() * newOrder.length);
        [newOrder[i], newOrder[j]] = [newOrder[j], newOrder[i]];
        return newOrder;
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
        
        return fullPath;
    }
}
