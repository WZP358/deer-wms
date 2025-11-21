class PathfindingManager {
    constructor() {
        this.worker = null;
        this.supportsWorker = typeof Worker !== 'undefined';
        this.initWorker();
    }

    initWorker() {
        if (this.supportsWorker) {
            try {
                this.worker = new Worker(ctx + '/js/pathfinding/pathfinding-worker.js');
            } catch (e) {
                console.warn('Web Worker initialization failed, falling back to main thread:', e);
                this.supportsWorker = false;
            }
        }
    }

    calculateOptimalPath(grid, entryPoint, targets, callback, options = {}) {
        if (!grid || !entryPoint || !targets || targets.length === 0) {
            callback({ success: false, error: '参数无效' });
            return;
        }

        if (this.supportsWorker && this.worker) {
            this.worker.onmessage = function(e) {
                callback(e.data);
            };

            this.worker.onerror = function(error) {
                console.error('Worker error:', error);
                callback({ success: false, error: error.message });
            };

            this.worker.postMessage({
                grid: grid,
                entryPoint: entryPoint,
                targets: targets,
                options: options
            });
        } else {
            this.calculateInMainThread(grid, entryPoint, targets, callback, options);
        }
    }

    calculateInMainThread(grid, entryPoint, targets, callback, options) {
        setTimeout(() => {
            try {
                const astar = new AStar(grid);
                const points = [entryPoint, ...targets];
                const n = points.length;
                const distanceMatrix = Array(n).fill(0).map(() => Array(n).fill(Infinity));

                for (let i = 0; i < n; i++) {
                    for (let j = i + 1; j < n; j++) {
                        const path = astar.findPath(points[i], points[j]);
                        if (path) {
                            distanceMatrix[i][j] = distanceMatrix[j][i] = path.length - 1;
                        }
                    }
                    distanceMatrix[i][i] = 0;
                }

                const sa = new SimulatedAnnealing(distanceMatrix, options);
                const result = sa.optimize(targets.length + 1);

                const optimizedTargets = result.route.slice(1).map(idx => targets[idx - 1]);
                
                const fullPath = [];
                let current = entryPoint;
                
                for (const target of optimizedTargets) {
                    const segment = astar.findPath(current, target);
                    if (segment) {
                        if (fullPath.length > 0) {
                            segment.shift();
                        }
                        fullPath.push(...segment);
                        current = target;
                    }
                }

                callback({
                    success: true,
                    path: fullPath,
                    visitOrder: optimizedTargets,
                    totalDistance: result.distance,
                    optimizedIndices: result.route.slice(1)
                });
            } catch (error) {
                callback({ success: false, error: error.message });
            }
        }, 0);
    }

    terminate() {
        if (this.worker) {
            this.worker.terminate();
            this.worker = null;
        }
    }
}
