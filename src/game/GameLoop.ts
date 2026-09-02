export interface GameLoopOptions {
  readonly fixedStep?: number;
  readonly maxCatchUpSteps?: number;
  readonly requestFrame?: (callback: FrameRequestCallback) => number;
  readonly cancelFrame?: (handle: number) => void;
}

export class GameLoop {
  private readonly fixedStep: number;
  private readonly maxCatchUpSteps: number;
  private readonly requestFrame: (callback: FrameRequestCallback) => number;
  private readonly cancelFrame: (handle: number) => void;
  private accumulator = 0;
  private lastTime: number | null = null;
  private frameHandle: number | null = null;
  private running = false;
  private paused = false;

  constructor(
    private readonly update: (step: number) => void,
    private readonly render: (alpha: number) => void,
    options: GameLoopOptions = {},
  ) {
    this.fixedStep = options.fixedStep ?? 1 / 30;
    this.maxCatchUpSteps = options.maxCatchUpSteps ?? 5;
    this.requestFrame = options.requestFrame ?? ((callback) => globalThis.requestAnimationFrame(callback));
    this.cancelFrame = options.cancelFrame ?? ((handle) => globalThis.cancelAnimationFrame(handle));
  }

  start(): void {
    if (this.running) return;
    this.running = true;
    this.lastTime = null;
    this.frameHandle = this.requestFrame(this.tick);
  }

  stop(): void {
    this.running = false;
    if (this.frameHandle !== null) this.cancelFrame(this.frameHandle);
    this.frameHandle = null;
    this.lastTime = null;
    this.accumulator = 0;
  }

  setPaused(paused: boolean): void { this.paused = paused; }
  restart(): void { this.stop(); this.start(); }

  advance(elapsedSeconds: number): void {
    if (!this.paused) {
      this.accumulator += Math.min(elapsedSeconds, this.fixedStep * this.maxCatchUpSteps);
      let steps = 0;
      while (this.accumulator >= this.fixedStep && steps < this.maxCatchUpSteps) {
        this.update(this.fixedStep);
        this.accumulator -= this.fixedStep;
        steps += 1;
      }
    }
    this.render(this.accumulator / this.fixedStep);
  }

  private readonly tick = (time: number): void => {
    if (!this.running) return;
    if (this.lastTime === null) this.lastTime = time;
    const elapsed = Math.max(0, (time - this.lastTime) / 1000);
    this.lastTime = time;
    this.advance(elapsed);
    this.frameHandle = this.requestFrame(this.tick);
  };

  dispose(): void { this.stop(); }
}
