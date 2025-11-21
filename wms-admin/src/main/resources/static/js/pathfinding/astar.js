class AStar {
    constructor(grid) {
        this.grid = grid;
        this.rows = grid.length;
        this.cols = grid[0] ? grid[0].length : 0;
    }

    heuristic(a, b) {
        return Math.abs(a.row - b.row) + Math.abs(a.col - b.col);
    }

    getNeighbors(node) {
        const neighbors = [];
        const directions = [
            { row: -1, col: 0 },
            { row: 1, col: 0 },
            { row: 0, col: -1 },
            { row: 0, col: 1 }
        ];

        for (const dir of directions) {
            const newRow = node.row + dir.row;
            const newCol = node.col + dir.col;

            if (newRow >= 0 && newRow < this.rows && 
                newCol >= 0 && newCol < this.cols) {
                neighbors.push({ row: newRow, col: newCol });
            }
        }

        return neighbors;
    }

    isWalkable(row, col) {
        if (row < 0 || row >= this.rows || col < 0 || col >= this.cols) {
            return false;
        }
        
        const cell = this.grid[row][col];
        if (!cell) return true;
        
        return cell.state !== 2 && cell.state !== 3;
    }

    findPath(start, end) {
        if (!this.isWalkable(start.row, start.col) || 
            !this.isWalkable(end.row, end.col)) {
            return null;
        }

        const openSet = [];
        const closedSet = new Set();
        const cameFrom = new Map();
        const gScore = new Map();
        const fScore = new Map();

        const startKey = `${start.row},${start.col}`;
        const endKey = `${end.row},${end.col}`;

        gScore.set(startKey, 0);
        fScore.set(startKey, this.heuristic(start, end));
        openSet.push({ ...start, f: fScore.get(startKey) });

        while (openSet.length > 0) {
            openSet.sort((a, b) => a.f - b.f);
            const current = openSet.shift();
            const currentKey = `${current.row},${current.col}`;

            if (currentKey === endKey) {
                return this.reconstructPath(cameFrom, current);
            }

            closedSet.add(currentKey);

            for (const neighbor of this.getNeighbors(current)) {
                const neighborKey = `${neighbor.row},${neighbor.col}`;

                if (closedSet.has(neighborKey) || 
                    !this.isWalkable(neighbor.row, neighbor.col)) {
                    continue;
                }

                const tentativeGScore = gScore.get(currentKey) + 1;

                const neighborInOpen = openSet.find(
                    n => `${n.row},${n.col}` === neighborKey
                );

                if (!neighborInOpen) {
                    openSet.push({
                        ...neighbor,
                        f: tentativeGScore + this.heuristic(neighbor, end)
                    });
                } else if (tentativeGScore >= gScore.get(neighborKey)) {
                    continue;
                }

                cameFrom.set(neighborKey, current);
                gScore.set(neighborKey, tentativeGScore);
                fScore.set(neighborKey, tentativeGScore + this.heuristic(neighbor, end));

                if (neighborInOpen) {
                    neighborInOpen.f = fScore.get(neighborKey);
                }
            }
        }

        return null;
    }

    reconstructPath(cameFrom, current) {
        const path = [{ row: current.row, col: current.col }];
        let currentKey = `${current.row},${current.col}`;

        while (cameFrom.has(currentKey)) {
            current = cameFrom.get(currentKey);
            currentKey = `${current.row},${current.col}`;
            path.unshift({ row: current.row, col: current.col });
        }

        return path;
    }
}

if (typeof module !== 'undefined' && module.exports) {
    module.exports = AStar;
}
