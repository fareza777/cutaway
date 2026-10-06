type Scheduler = {
  request: (callback: (time: number) => void) => number;
  cancel: (id: number) => void;
};

/** One cancellable frame chain; suspended time never advances the simulation. */
export class FrameLoop {
  private frame: number | null = null;
  private lastTime: number | null = null;
  private active = false;
  private disposed = false;
  private draw: (delta: number) => void;
  private scheduler: Scheduler;

  constructor(draw: (delta: number) => void, scheduler?: Scheduler) {
    this.draw = draw;
    this.scheduler = scheduler ?? {
      request: (callback) => requestAnimationFrame(callback),
      cancel: (id) => cancelAnimationFrame(id),
    };
  }

  setActive(active: boolean) {
    if (this.disposed || active === this.active) return;
    this.active = active;
    this.lastTime = null;
    if (active) {
      this.frame = this.scheduler.request(this.tick);
    } else if (this.frame !== null) {
      this.scheduler.cancel(this.frame);
      this.frame = null;
    }
  }

  private tick = (time: number) => {
    this.frame = null;
    if (!this.active || this.disposed) return;
    const delta = this.lastTime === null ? 0 : Math.max(0, Math.min((time - this.lastTime) / 1000, 0.05));
    this.lastTime = time;
    this.draw(delta);
    if (this.active && !this.disposed && this.frame === null) this.frame = this.scheduler.request(this.tick);
  };

  dispose() {
    this.setActive(false);
    this.disposed = true;
  }
}
