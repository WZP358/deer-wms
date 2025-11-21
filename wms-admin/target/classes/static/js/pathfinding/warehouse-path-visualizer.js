/**
 * Simple helper to render warehouse routing paths on top of grid-based boards.
 * The visualizer expects logical grid positions that follow the same convention
 * as the pathfinding service: occupied cells sit on odd (row, col) coordinates
 * while walkable aisles occupy the even coordinates between them.
 *
 * layoutCols / layoutRows represent the total number of logical storage columns
 * and rows (i.e. the number of physical cells visible on the board). Internal
 * grid coordinates are still expressed in the doubled system produced by
 * buildGrid (2 * cells + 1). This allows us to project aisle coordinates by
 * scaling them with half-cell steps.
 */
class WarehousePathVisualizer {
    constructor(canvasId) {
        this.canvasId = canvasId;
        this.canvas = null;
        this.metrics = null;
        this.path = [];
        this.animationState = null;
        this._boundAnimateFrame = this._handleAnimationFrame.bind(this);
    }

    setMetrics(metrics) {
        this.metrics = Object.assign({}, metrics || {});
    }

    setPath(path) {
        this.path = Array.isArray(path) ? path.slice() : [];
    }

    clear() {
        this.stopAnimation(true);
        const canvas = this._getCanvas();
        if (!canvas) {
            return;
        }
        const ctx = canvas.getContext('2d');
        ctx && ctx.clearRect(0, 0, canvas.width, canvas.height);
    }

    render() {
        if (!this.metrics || !this.metrics.layoutCols || !this.metrics.layoutRows) {
            this.clear();
            return;
        }
        if (!this.path || this.path.length < 2) {
            this.clear();
            return;
        }

        const canvas = this._getCanvas();
        if (!canvas) {
            return;
        }
        const parent = canvas.parentElement;
        if (!parent) {
            return;
        }

        const width = parent.clientWidth;
        const height = parent.clientHeight;
        if (width === 0 || height === 0) {
            this.clear();
            return;
        }

        canvas.width = width;
        canvas.height = height;

        const ctx = canvas.getContext('2d');
        if (!ctx) {
            return;
        }

        ctx.clearRect(0, 0, width, height);

        const cellWidth = width / this.metrics.layoutCols;
        const cellHeight = height / this.metrics.layoutRows;

        const points = this.path.map(pos => {
            return {
                x: (pos.col / 2) * cellWidth,
                y: (pos.row / 2) * cellHeight
            };
        });

        this._strokePath(ctx, points, points.length - 1, 1);
    }

    startAnimation(options) {
        options = options || {};
        if (!this.path || this.path.length < 2) {
            return false;
        }
        if (!this.metrics || !this.metrics.layoutCols || !this.metrics.layoutRows) {
            return false;
        }
        this.stopAnimation(false);
        this.animationState = {
            running: true,
            paused: false,
            speed: options.speed || 2.8,
            rafId: null,
            lastTimestamp: null,
            progress: 0,
            totalSegments: Math.max(this.path.length - 1, 1),
            onUpdate: typeof options.onUpdate === 'function' ? options.onUpdate : null,
            onComplete: typeof options.onComplete === 'function' ? options.onComplete : null
        };
        this._renderPartial(0);
        this.animationState.rafId = requestAnimationFrame(this._boundAnimateFrame);
        return true;
    }

    pauseAnimation() {
        if (!this.animationState || !this.animationState.running) {
            return;
        }
        this.animationState.paused = true;
    }

    resumeAnimation() {
        if (!this.animationState || !this.animationState.running) {
            return;
        }
        if (!this.animationState.paused) {
            return;
        }
        this.animationState.paused = false;
        this.animationState.lastTimestamp = null;
        this.animationState.rafId = requestAnimationFrame(this._boundAnimateFrame);
    }

    stopAnimation(clearCanvas) {
        if (this.animationState && this.animationState.rafId) {
            cancelAnimationFrame(this.animationState.rafId);
        }
        this.animationState = null;
        if (clearCanvas) {
            const canvas = this._getCanvas();
            if (canvas) {
                const ctx = canvas.getContext('2d');
                ctx && ctx.clearRect(0, 0, canvas.width, canvas.height);
            }
        }
    }

    isAnimating() {
        return !!(this.animationState && this.animationState.running && !this.animationState.paused);
    }

    _getCanvas() {
        if (this.canvas) {
            return this.canvas;
        }
        if (!this.canvasId) {
            return null;
        }
        this.canvas = document.getElementById(this.canvasId);
        return this.canvas;
    }

    _renderPartial(progress) {
        if (!this.metrics || !this.metrics.layoutCols || !this.metrics.layoutRows) {
            return;
        }
        if (!this.path || this.path.length < 2) {
            return;
        }
        const canvas = this._getCanvas();
        if (!canvas) {
            return;
        }
        const parent = canvas.parentElement;
        if (!parent) {
            return;
        }
        const width = parent.clientWidth;
        const height = parent.clientHeight;
        if (width === 0 || height === 0) {
            return;
        }
        canvas.width = width;
        canvas.height = height;
        const ctx = canvas.getContext('2d');
        if (!ctx) {
            return;
        }
        const cellWidth = width / this.metrics.layoutCols;
        const cellHeight = height / this.metrics.layoutRows;
        const points = this.path.map(pos => {
            return {
                x: (pos.col / 2) * cellWidth,
                y: (pos.row / 2) * cellHeight
            };
        });
        const totalSegments = Math.max(points.length - 1, 1);
        const clamped = Math.min(Math.max(progress, 0), totalSegments);
        const integerIndex = Math.floor(clamped);
        const fraction = Math.min(clamped - integerIndex, 1);
        this._strokePath(ctx, points, integerIndex, fraction);
    }

    _strokePath(ctx, points, integerIndex, fraction) {
        if (!points || points.length < 2) {
            return;
        }
        ctx.clearRect(0, 0, ctx.canvas.width, ctx.canvas.height);
        ctx.lineWidth = 4;
        ctx.lineJoin = 'round';
        ctx.lineCap = 'round';
        const startPoint = points[0];
        const endPoint = points[points.length - 1];
        const gradient = ctx.createLinearGradient(startPoint.x, startPoint.y, endPoint.x, endPoint.y);
        gradient.addColorStop(0, '#2EC7FF');
        gradient.addColorStop(0.5, '#36D1A8');
        gradient.addColorStop(1, '#FFBA00');
        ctx.strokeStyle = gradient;
        ctx.shadowColor = 'rgba(64, 158, 255, 0.35)';
        ctx.shadowBlur = 8;
        ctx.beginPath();
        ctx.moveTo(startPoint.x, startPoint.y);
        for (let i = 1; i <= integerIndex && i < points.length; i++) {
            ctx.lineTo(points[i].x, points[i].y);
        }
        let marker = points[Math.min(integerIndex, points.length - 1)];
        if (integerIndex < points.length - 1) {
            const nextPoint = points[integerIndex + 1];
            const interpX = marker.x + (nextPoint.x - marker.x) * fraction;
            const interpY = marker.y + (nextPoint.y - marker.y) * fraction;
            ctx.lineTo(interpX, interpY);
            marker = { x: interpX, y: interpY };
        }
        ctx.stroke();
        ctx.fillStyle = 'rgba(64, 158, 255, 0.92)';
        ctx.beginPath();
        ctx.arc(marker.x, marker.y, 7, 0, Math.PI * 2);
        ctx.fill();
        ctx.fillStyle = 'rgba(64, 158, 255, 0.25)';
        ctx.beginPath();
        ctx.arc(marker.x, marker.y, 14, 0, Math.PI * 2);
        ctx.fill();
    }

    _handleAnimationFrame(timestamp) {
        if (!this.animationState || !this.animationState.running) {
            return;
        }
        if (this.animationState.paused) {
            this.animationState.rafId = requestAnimationFrame(this._boundAnimateFrame);
            return;
        }
        if (!this.animationState.lastTimestamp) {
            this.animationState.lastTimestamp = timestamp;
            this.animationState.rafId = requestAnimationFrame(this._boundAnimateFrame);
            return;
        }
        const delta = (timestamp - this.animationState.lastTimestamp) / 1000;
        this.animationState.lastTimestamp = timestamp;
        this.animationState.progress += delta * this.animationState.speed;
        const totalSegments = this.animationState.totalSegments;
        if (this.animationState.progress >= totalSegments) {
            this.animationState.progress = totalSegments;
        }
        this._renderPartial(this.animationState.progress);
        if (typeof this.animationState.onUpdate === 'function') {
            const index = Math.min(Math.floor(this.animationState.progress), this.path.length - 1);
            this.animationState.onUpdate(this.path[index], index);
        }
        if (this.animationState.progress >= totalSegments) {
            const onComplete = this.animationState.onComplete;
            this.animationState.running = false;
            this.animationState = null;
            if (typeof onComplete === 'function') {
                onComplete();
            } else {
                this.render();
            }
            return;
        }
        this.animationState.rafId = requestAnimationFrame(this._boundAnimateFrame);
    }
}

window.WarehousePathVisualizer = WarehousePathVisualizer;

