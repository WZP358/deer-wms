class SimulatedAnnealing {
    constructor(distanceMatrix, options = {}) {
        this.distanceMatrix = distanceMatrix;
        this.initialTemp = options.initialTemp || 800;
        this.coolingRate = options.coolingRate || 0.992;
        this.minTemp = options.minTemp || 0.1;
        this.maxIterations = options.maxIterations || 20000;
        this.twoOptProbability = options.twoOptProbability || 0.4;
        this.stagnationLimit = options.stagnationLimit || 800;
    }

    calculateTotalDistance(route) {
        let total = 0;
        for (let i = 0; i < route.length - 1; i++) {
            total += this.distanceMatrix[route[i]][route[i + 1]];
        }
        return total;
    }

    swapNeighbor(route) {
        const newRoute = [...route];
        const i = Math.floor(Math.random() * newRoute.length);
        const j = Math.floor(Math.random() * newRoute.length);
        [newRoute[i], newRoute[j]] = [newRoute[j], newRoute[i]];
        return newRoute;
    }

    twoOptNeighbor(route) {
        const newRoute = [...route];
        let i = Math.floor(Math.random() * (newRoute.length - 1));
        let j = i + 1 + Math.floor(Math.random() * (newRoute.length - i - 1));
        while (i >= j) {
            i = Math.floor(Math.random() * (newRoute.length - 1));
            j = i + 1 + Math.floor(Math.random() * (newRoute.length - i - 1));
        }
        while (i < j) {
            [newRoute[i], newRoute[j]] = [newRoute[j], newRoute[i]];
            i++;
            j--;
        }
        return newRoute;
    }

    generateNeighbor(route) {
        if (route.length < 3) {
            return this.swapNeighbor(route);
        }
        if (Math.random() < this.twoOptProbability) {
            return this.twoOptNeighbor(route);
        }
        return this.swapNeighbor(route);
    }

    buildInitialRoute(numPoints) {
        const remaining = [];
        for (let i = 1; i < numPoints; i++) {
            remaining.push(i);
        }

        const route = [0];
        let currentIndex = 0;

        while (remaining.length > 0) {
            let bestIdx = 0;
            let bestDistance = Infinity;

            for (let i = 0; i < remaining.length; i++) {
                const candidate = remaining[i];
                const distance = this.distanceMatrix[currentIndex][candidate];
                if (distance < bestDistance) {
                    bestDistance = distance;
                    bestIdx = i;
                }
            }

            currentIndex = remaining.splice(bestIdx, 1)[0];
            route.push(currentIndex);
        }

        return route;
    }

    localRefinement(route) {
        if (route.length < 4) {
            return route;
        }

        let bestRoute = [...route];
        let improved = true;

        while (improved) {
            improved = false;
            for (let i = 1; i < bestRoute.length - 2; i++) {
                for (let j = i + 1; j < bestRoute.length - 1; j++) {
                    const candidate = [
                        ...bestRoute.slice(0, i),
                        ...bestRoute.slice(i, j + 1).reverse(),
                        ...bestRoute.slice(j + 1)
                    ];

                    if (this.calculateTotalDistance(candidate) < this.calculateTotalDistance(bestRoute)) {
                        bestRoute = candidate;
                        improved = true;
                        break;
                    }
                }
                if (improved) {
                    break;
                }
            }
        }

        return bestRoute;
    }

    acceptanceProbability(currentDistance, newDistance, temperature) {
        if (newDistance < currentDistance) {
            return 1.0;
        }
        return Math.exp((currentDistance - newDistance) / Math.max(temperature, 1e-9));
    }

    optimize(numPoints) {
        if (numPoints <= 0) {
            return { route: [], distance: 0, iterations: 0 };
        }

        let currentRoute = this.buildInitialRoute(numPoints);
        if (currentRoute.length === 0) {
            currentRoute = Array.from({ length: numPoints }, (_, i) => i);
        }

        let currentDistance = this.calculateTotalDistance(currentRoute);
        let bestRoute = [...currentRoute];
        let bestDistance = currentDistance;

        let temperature = this.initialTemp;
        let iteration = 0;
        let stagnationCounter = 0;

        while (temperature > this.minTemp && iteration < this.maxIterations) {
            const newRoute = this.generateNeighbor(currentRoute);
            const newDistance = this.calculateTotalDistance(newRoute);

            if (this.acceptanceProbability(currentDistance, newDistance, temperature) > Math.random()) {
                currentRoute = newRoute;
                currentDistance = newDistance;

                if (currentDistance < bestDistance) {
                    bestRoute = [...currentRoute];
                    bestDistance = currentDistance;
                    stagnationCounter = 0;
                } else {
                    stagnationCounter++;
                }
            } else {
                stagnationCounter++;
            }

            if (stagnationCounter > this.stagnationLimit) {
                currentRoute = this.localRefinement(currentRoute);
                currentDistance = this.calculateTotalDistance(currentRoute);
                stagnationCounter = 0;
                temperature *= 0.9;
                continue;
            }

            temperature *= this.coolingRate;
            iteration++;
        }

        if (stagnationCounter > 0) {
            const refined = this.localRefinement(bestRoute);
            const refinedDistance = this.calculateTotalDistance(refined);
            if (refinedDistance < bestDistance) {
                bestRoute = refined;
                bestDistance = refinedDistance;
            }
        }

        return {
            route: bestRoute,
            distance: bestDistance,
            iterations: iteration
        };
    }
}

if (typeof module !== 'undefined' && module.exports) {
    module.exports = SimulatedAnnealing;
}
