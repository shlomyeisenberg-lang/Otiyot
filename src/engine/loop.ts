// The fixed-step clock. Game logic always advances in equal steps (1/60 s) however fast the
// screen redraws, so typing feel and animation speed are the same on every machine.
// Pure logic: the caller feeds real elapsed time; nothing here touches the DOM.

export const FIXED_STEP = 1 / 60;

export interface LoopHandlers {
  /** One logic step of exactly `dt` seconds (already scaled by hit-stop). */
  update(dt: number): void;
  /** Called once per frame after the steps. `realDt` is unscaled, for camera and screen effects. */
  frame(realDt: number): void;
}

export class FixedLoop {
  /** Steps per frame are capped so a long stall (tab in the background) never spirals. */
  readonly maxSteps: number;
  readonly step: number;
  private acc = 0;
  private stopLeft = 0;
  private stopScale = 0;
  /** Total simulated seconds. */
  time = 0;
  /** Steps run by the last `advance` (for tests and the perf overlay). */
  lastSteps = 0;

  constructor(step = FIXED_STEP, maxSteps = 5) {
    this.step = step;
    this.maxSteps = maxSteps;
  }

  /**
   * Hit-stop: the world freezes (or crawls at `scale`) for `seconds` of real time while the
   * screen keeps drawing. A longer stop already running is kept.
   */
  hitStop(seconds: number, scale = 0): void {
    if (seconds > this.stopLeft) {
      this.stopLeft = seconds;
      this.stopScale = scale;
    }
  }

  get stopped(): boolean {
    return this.stopLeft > 0;
  }

  advance(realDt: number, handlers: LoopHandlers): void {
    const dt = realDt > 0.25 ? 0.25 : realDt < 0 ? 0 : realDt;
    let scale = 1;
    if (this.stopLeft > 0) {
      scale = this.stopScale;
      this.stopLeft -= dt;
      if (this.stopLeft < 0) this.stopLeft = 0;
    }
    this.acc += dt * scale;
    let steps = 0;
    while (this.acc >= this.step && steps < this.maxSteps) {
      handlers.update(this.step);
      this.acc -= this.step;
      this.time += this.step;
      steps += 1;
    }
    // Drop what could not be caught up, instead of running ever further behind.
    if (steps === this.maxSteps && this.acc > this.step) this.acc = 0;
    this.lastSteps = steps;
    handlers.frame(dt);
  }

  reset(): void {
    this.acc = 0;
    this.stopLeft = 0;
    this.time = 0;
    this.lastSteps = 0;
  }
}
