class PathAnimator {
    constructor(canvasSelector) {
        this.canvas = document.querySelector(canvasSelector);
        this.path = [];
        this.visitOrder = [];
        this.currentIndex = 0;
        this.isPlaying = false;
        this.isPaused = false;
        this.speed = 200;
        this.intervalId = null;
        this.onStepCallback = null;
        this.onCompleteCallback = null;
    }

    setPath(path, visitOrder) {
        this.path = path || [];
        this.visitOrder = visitOrder || [];
        this.currentIndex = 0;
    }

    setSpeed(speed) {
        this.speed = Math.max(50, Math.min(1000, speed));
        if (this.isPlaying && !this.isPaused) {
            this.stop();
            this.start();
        }
    }

    setCallbacks(onStep, onComplete) {
        this.onStepCallback = onStep;
        this.onCompleteCallback = onComplete;
    }

    start() {
        if (this.path.length === 0) {
            console.warn('No path to animate');
            return;
        }

        this.isPlaying = true;
        this.isPaused = false;
        this.currentIndex = 0;

        this.intervalId = setInterval(() => {
            if (this.currentIndex >= this.path.length) {
                this.stop();
                if (this.onCompleteCallback) {
                    this.onCompleteCallback();
                }
                return;
            }

            const current = this.path[this.currentIndex];
            
            if (this.onStepCallback) {
                const visitIndex = this.visitOrder.findIndex(
                    v => v.row === current.row && v.col === current.col
                );
                this.onStepCallback(current, this.currentIndex, visitIndex);
            }

            this.currentIndex++;
        }, this.speed);
    }

    pause() {
        if (this.isPlaying && !this.isPaused) {
            this.isPaused = true;
            if (this.intervalId) {
                clearInterval(this.intervalId);
                this.intervalId = null;
            }
        }
    }

    resume() {
        if (this.isPlaying && this.isPaused) {
            this.isPaused = false;
            this.intervalId = setInterval(() => {
                if (this.currentIndex >= this.path.length) {
                    this.stop();
                    if (this.onCompleteCallback) {
                        this.onCompleteCallback();
                    }
                    return;
                }

                const current = this.path[this.currentIndex];
                
                if (this.onStepCallback) {
                    const visitIndex = this.visitOrder.findIndex(
                        v => v.row === current.row && v.col === current.col
                    );
                    this.onStepCallback(current, this.currentIndex, visitIndex);
                }

                this.currentIndex++;
            }, this.speed);
        }
    }

    stop() {
        this.isPlaying = false;
        this.isPaused = false;
        this.currentIndex = 0;
        if (this.intervalId) {
            clearInterval(this.intervalId);
            this.intervalId = null;
        }
    }

    reset() {
        this.stop();
        this.currentIndex = 0;
    }

    getProgress() {
        if (this.path.length === 0) return 0;
        return (this.currentIndex / this.path.length) * 100;
    }

    isAnimating() {
        return this.isPlaying && !this.isPaused;
    }
}
