self.onmessage = function(e) {
    const { type, data } = e.data;

    if (type === "findPath") {
        const path = findShortestPath(data.grid, data.start, data.end, data.allowDiagonal);
        self.postMessage({ type: "pathResult", path });
        return;
    }

    if (type === "optimizeRoute") {
        const result = optimizeMultiPointRoute(data.grid, data.start, data.targets, data.allowDiagonal, data.saParams);
        self.postMessage({ type: "routeResult", result });
        return;
    }

    // Fallback for legacy manager messages without explicit type
    if (e.data && e.data.entryPoint && e.data.grid && e.data.targets) {
        const options = e.data.options || {};
        const result = optimizeMultiPointRoute(e.data.grid, e.data.entryPoint, e.data.targets, options.allowDiagonal, options);
        self.postMessage({
            success: result.success,
            path: result.path,
            visitOrder: result.orderedTargets || [],
            totalDistance: result.distance,
            optimizedIndices: (result.order || []).map(idx => idx + 1),
            error: result.success ? null : '路径计算失败'
        });
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
    const config = normalizeSaOptions(saParams);
    
    if (!targets || targets.length === 0) {
        return { success: true, path: [start], distance: 0, order: [], orderedTargets: [] };
    }

    if (targets.length === 1) {
        const path = findShortestPath(grid, start, targets[0], allowDiagonal);
        return { 
            success: Boolean(path),
            path: path || [start], 
            distance: path ? path.length - 1 : Infinity,
            order: [0],
            orderedTargets: [targets[0]]
        };
    }
    
    const distanceMatrix = buildDistanceMatrix(grid, start, targets, allowDiagonal);
    let currentOrder = buildInitialOrder(distanceMatrix, targets.length);
    if (currentOrder.length === 0) {
        currentOrder = targets.map((_, idx) => idx);
    }

    let currentDistance = calculateTotalDistance(currentOrder, distanceMatrix);
    let bestOrder = currentOrder.slice();
    let bestDistance = currentDistance;
    
    let temp = config.initialTemp;
    let iterations = 0;
    let stagnationCounter = 0;
    
    while (temp > config.minTemp && iterations < config.maxIterations) {
        const newOrder = mutateOrder(currentOrder, config.twoOptProbability);
        const newDistance = calculateTotalDistance(newOrder, distanceMatrix);
        
        const delta = newDistance - currentDistance;
        if (delta < 0 || Math.random() < Math.exp(-delta / Math.max(temp, 1e-9))) {
            currentOrder = newOrder;
            currentDistance = newDistance;
            
            if (currentDistance < bestDistance) {
                bestOrder = currentOrder.slice();
                bestDistance = currentDistance;
                stagnationCounter = 0;
            } else {
                stagnationCounter++;
            }
        } else {
            stagnationCounter++;
        }
        
        if (stagnationCounter > config.stagnationLimit) {
            currentOrder = localRefinement(currentOrder, distanceMatrix);
            currentDistance = calculateTotalDistance(currentOrder, distanceMatrix);
            stagnationCounter = 0;
            temp *= 0.9;
            continue;
        }
        
        temp *= config.coolingRate;
        iterations++;
    }

    if (stagnationCounter > 0) {
        const refinedOrder = localRefinement(bestOrder, distanceMatrix);
        const refinedDistance = calculateTotalDistance(refinedOrder, distanceMatrix);
        if (refinedDistance < bestDistance) {
            bestOrder = refinedOrder;
            bestDistance = refinedDistance;
        }
    }
    
    const orderedTargets = [];
    for (let i = 0; i < bestOrder.length; i++) {
        orderedTargets.push(targets[bestOrder[i]]);
    }
    const fullPath = buildFullPath(grid, start, orderedTargets, allowDiagonal);
    
    return {
        success: Number.isFinite(bestDistance),
        path: fullPath,
        distance: bestDistance,
        order: bestOrder,
        orderedTargets
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
    if (!order || order.length === 0) {
        return 0;
    }

    var total = distanceMatrix[0][order[0] + 1];
    
    for (var i = 0; i < order.length - 1; i++) {
        total += distanceMatrix[order[i] + 1][order[i + 1] + 1];
    }
    
    return total;
}

function buildInitialOrder(distanceMatrix, targetCount) {
    const order = [];
    const remaining = [];
    for (let i = 0; i < targetCount; i++) {
        remaining.push(i);
    }

    let currentIndex = 0; // start point in matrix
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

function mutateOrder(order, twoOptProbability) {
    const newOrder = order.slice();
    if (newOrder.length < 3 || Math.random() > twoOptProbability) {
        const i = Math.floor(Math.random() * newOrder.length);
        const j = Math.floor(Math.random() * newOrder.length);
        const temp = newOrder[i];
        newOrder[i] = newOrder[j];
        newOrder[j] = temp;
        return newOrder;
    }

    const i = Math.floor(Math.random() * (newOrder.length - 1));
    const j = i + 1 + Math.floor(Math.random() * (newOrder.length - i - 1));
    return twoOptSwap(newOrder, i, j);
}

function twoOptSwap(order, i, k) {
    const newOrder = order.slice();
    while (i < k) {
        const temp = newOrder[i];
        newOrder[i] = newOrder[k];
        newOrder[k] = temp;
        i++;
        k--;
    }
    return newOrder;
}

function localRefinement(order, distanceMatrix) {
    if (order.length < 4) {
        return order.slice();
    }

    let bestOrder = order.slice();
    let improved = true;

    while (improved) {
        improved = false;
        for (let i = 0; i < bestOrder.length - 2; i++) {
            for (let j = i + 1; j < bestOrder.length - 1; j++) {
                const candidate = twoOptSwap(bestOrder.slice(), i, j);
                if (calculateTotalDistance(candidate, distanceMatrix) < calculateTotalDistance(bestOrder, distanceMatrix)) {
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

function normalizeSaOptions(saParams) {
    const params = saParams || {};
    return {
        initialTemp: params.initialTemp || 800,
        coolingRate: params.coolingRate || 0.992,
        minTemp: params.minTemp || 0.1,
        maxIterations: params.maxIterations || 20000,
        twoOptProbability: params.twoOptProbability || 0.4,
        stagnationLimit: params.stagnationLimit || 800
    };
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
