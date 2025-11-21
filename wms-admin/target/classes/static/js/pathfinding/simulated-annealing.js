class SimulatedAnnealing {
    constructor(distanceMatrix, options = {}) {
        this.distanceMatrix = distanceMatrix;
        this.initialTemp = options.initialTemp || 10000;
        this.coolingRate = options.coolingRate || 0.995;
        this.minTemp = options.minTemp || 1;
        this.maxIterations = options.maxIterations || 50000;
    }

    calculateTotalDistance(route) {
        let total = 0;
        for (let i = 0; i < route.length - 1; i++) {
            total += this.distanceMatrix[route[i]][route[i + 1]];
        }
        return total;
    }

    generateNeighbor(route) {
        const newRoute = [...route];
        const i = Math.floor(Math.random() * newRoute.length);
        const j = Math.floor(Math.random() * newRoute.length);
        [newRoute[i], newRoute[j]] = [newRoute[j], newRoute[i]];
        return newRoute;
    }

    acceptanceProbability(currentDistance, newDistance, temperature) {
        if (newDistance < currentDistance) {
            return 1.0;
        }
        return Math.exp((currentDistance - newDistance) / temperature);
    }

    optimize(numPoints) {
        let currentRoute = Array.from({ length: numPoints }, (_, i) => i);
        for (let i = currentRoute.length - 1; i > 0; i--) {
            const j = Math.floor(Math.random() * (i + 1));
            [currentRoute[i], currentRoute[j]] = [currentRoute[j], currentRoute[i]];
        }

        let currentDistance = this.calculateTotalDistance(currentRoute);
        let bestRoute = [...currentRoute];
        let bestDistance = currentDistance;

        let temperature = this.initialTemp;
        let iteration = 0;

        while (temperature > this.minTemp && iteration < this.maxIterations) {
            const newRoute = this.generateNeighbor(currentRoute);
            const newDistance = this.calculateTotalDistance(newRoute);

            if (this.acceptanceProbability(currentDistance, newDistance, temperature) > Math.random()) {
                currentRoute = newRoute;
                currentDistance = newDistance;

                if (currentDistance < bestDistance) {
                    bestRoute = [...currentRoute];
                    bestDistance = currentDistance;
                }
            }

            temperature *= this.coolingRate;
            iteration++;
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
