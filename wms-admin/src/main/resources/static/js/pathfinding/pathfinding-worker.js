self.onmessage = function(e) {
    const { type, data } = e.data;
    
    if (type === "findPath") {
        const path = findShortestPath(data.grid, data.start, data.end, data.allowDiagonal);
        self.postMessage({ type: "pathResult", path });
    } else if (type === "optimizeRoute") {
        const result = optimizeMultiPointRoute(data.grid, data.start, data.targets, data.allowDiagonal, data.saParams);
        self.postMessage({ type: "routeResult", result });
    }
};

function findShortestPath(grid, start, end, allowDiagonal) {
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
    visited.add(start.row + "," + start.col);
    
    const directions = [
        [-1, 0], [1, 0], [0, -1], [0, 1]
    ];
    
    if (allowDiagonal) {
        directions.push([-1, -1], [-1, 1], [1, -1], [1, 1]);
    }
    
    while (queue.length > 0) {
        const current = queue.shift();
        const row = current[0];
        const col = current[1];
        const path = current[2];
        
        if (row === end.row && col === end.col) {
            return path;
        }
        
        for (var d = 0; d < directions.length; d++) {
            const dir = directions[d];
            const newRow = row + dir[0];
            const newCol = col + dir[1];
            const key = newRow + "," + newCol;
            
            if (isWalkable(newRow, newCol) && !visited.has(key)) {
                visited.add(key);
                var newPath = path.slice();
                newPath.push({row: newRow, col: newCol});
                queue.push([newRow, newCol, newPath]);
            }
        }
    }
    
    return null;
}

function optimizeMultiPointRoute(grid, start, targets, allowDiagonal, saParams) {
    const initialTemp = saParams.initialTemp || 1000;
    const coolingRate = saParams.coolingRate || 0.995;
    const minTemp = saParams.minTemp || 1;
    const maxIterations = saParams.maxIterations || 5000;
    
    if (targets.length === 0) return { path: [start], distance: 0, order: [] };
    if (targets.length === 1) {
        const path = findShortestPath(grid, start, targets[0], allowDiagonal);
        return { 
            path: path || [start], 
            distance: path ? path.length - 1 : 0,
            order: [0]
        };
    }
    
    const distanceMatrix = buildDistanceMatrix(grid, start, targets, allowDiagonal);
    
    var currentOrder = [];
    for (var i = 0; i < targets.length; i++) {
        currentOrder.push(i);
    }
    var currentDistance = calculateTotalDistance(currentOrder, distanceMatrix);
    var bestOrder = currentOrder.slice();
    var bestDistance = currentDistance;
    
    var temp = initialTemp;
    var iterations = 0;
    
    while (temp > minTemp && iterations < maxIterations) {
        const newOrder = mutateOrder(currentOrder);
        const newDistance = calculateTotalDistance(newOrder, distanceMatrix);
        
        const delta = newDistance - currentDistance;
        
        if (delta < 0 || Math.random() < Math.exp(-delta / temp)) {
            currentOrder = newOrder;
            currentDistance = newDistance;
            
            if (currentDistance < bestDistance) {
                bestOrder = currentOrder.slice();
                bestDistance = currentDistance;
            }
        }
        
        temp *= coolingRate;
        iterations++;
    }
    
    var orderedTargets = [];
    for (var i = 0; i < bestOrder.length; i++) {
        orderedTargets.push(targets[bestOrder[i]]);
    }
    const fullPath = buildFullPath(grid, start, orderedTargets, allowDiagonal);
    
    return {
        path: fullPath,
        distance: bestDistance,
        order: bestOrder
    };
}

function buildDistanceMatrix(grid, start, targets, allowDiagonal) {
    var points = [start];
    for (var i = 0; i < targets.length; i++) {
        points.push(targets[i]);
    }
    const n = points.length;
    var matrix = [];
    for (var i = 0; i < n; i++) {
        var row = [];
        for (var j = 0; j < n; j++) {
            row.push(Infinity);
        }
        matrix.push(row);
    }
    
    for (var i = 0; i < n; i++) {
        matrix[i][i] = 0;
        for (var j = i + 1; j < n; j++) {
            const path = findShortestPath(grid, points[i], points[j], allowDiagonal);
            const dist = path ? path.length - 1 : Infinity;
            matrix[i][j] = dist;
            matrix[j][i] = dist;
        }
    }
    
    return matrix;
}

function calculateTotalDistance(order, distanceMatrix) {
    var total = distanceMatrix[0][order[0] + 1];
    
    for (var i = 0; i < order.length - 1; i++) {
        total += distanceMatrix[order[i] + 1][order[i + 1] + 1];
    }
    
    return total;
}

function mutateOrder(order) {
    var newOrder = order.slice();
    const i = Math.floor(Math.random() * newOrder.length);
    const j = Math.floor(Math.random() * newOrder.length);
    var temp = newOrder[i];
    newOrder[i] = newOrder[j];
    newOrder[j] = temp;
    return newOrder;
}

function buildFullPath(grid, start, orderedTargets, allowDiagonal) {
    var fullPath = [start];
    var current = start;
    
    for (var i = 0; i < orderedTargets.length; i++) {
        const target = orderedTargets[i];
        const segment = findShortestPath(grid, current, target, allowDiagonal);
        if (segment && segment.length > 1) {
            for (var j = 1; j < segment.length; j++) {
                fullPath.push(segment[j]);
            }
            current = target;
        }
    }
    
    return fullPath;
}
