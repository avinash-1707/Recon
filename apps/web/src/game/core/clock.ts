/**
 * Fixed-timestep accumulator clock.
 *
 * Gameplay logic that must be deterministic and framerate-independent (AI ticks,
 * weapon fire-rate, movement integration) runs in discrete fixed slices. Render
 * code reads `alpha` (0..1) to interpolate visual state between the last two
 * fixed steps so motion stays smooth even when render FPS ≠ logic Hz.
 *
 * Rapier owns its own fixed stepper for rigid bodies; this drives *our* systems.
 */
export class FixedClock {
  private accumulator = 0;
  private _alpha = 0;

  /**
   * @param fixedDt    seconds per logic step (default 1/60)
   * @param maxSubSteps cap on steps per frame - prevents the "spiral of death"
   *                    after a stall or backgrounded tab (huge rawDt).
   */
  constructor(
    public readonly fixedDt: number = 1 / 60,
    private readonly maxSubSteps: number = 5,
  ) {}

  /** Interpolation factor into the current (incomplete) step, 0..1. */
  get alpha(): number {
    return this._alpha;
  }

  /**
   * Feed the raw frame delta. Invokes `step(fixedDt)` for each whole slice that
   * has accumulated. Returns the number of steps executed this frame.
   */
  advance(rawDt: number, step: (dt: number) => void): number {
    // Clamp so a 2s stall doesn't try to run 120 steps and freeze the tab.
    this.accumulator += Math.min(rawDt, this.fixedDt * this.maxSubSteps);

    let steps = 0;
    while (this.accumulator >= this.fixedDt) {
      step(this.fixedDt);
      this.accumulator -= this.fixedDt;
      steps++;
    }

    this._alpha = this.accumulator / this.fixedDt;
    return steps;
  }

  reset(): void {
    this.accumulator = 0;
    this._alpha = 0;
  }
}
