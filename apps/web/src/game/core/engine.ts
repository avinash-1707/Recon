import type { GameContext, GameModule } from "./types";
import { FixedClock } from "./clock";

/**
 * Central engine. Owns the fixed clock and the ordered list of modules
 * (systems + entities). Each frame it advances logic in fixed slices, then runs
 * a variable per-frame pass with the interpolation alpha.
 *
 * Modules can register before OR after `init` - late registrations are inited
 * on the spot using the stored context, so React entities can attach as they
 * mount without caring about engine boot order.
 */
export class Engine {
  private readonly modules: GameModule[] = [];
  private readonly clock: FixedClock;
  private ctx: GameContext | null = null;
  private started = false;

  constructor(fixedDt = 1 / 60) {
    this.clock = new FixedClock(fixedDt);
  }

  get fixedDt(): number {
    return this.clock.fixedDt;
  }

  register(module: GameModule): this {
    if (this.modules.some((m) => m.id === module.id)) {
      throw new Error(`Engine: duplicate module id "${module.id}"`);
    }
    this.modules.push(module);
    // Keep modules sorted by update order (stable for equal orders).
    this.modules.sort((a, b) => (a.order ?? 0) - (b.order ?? 0));
    // If the engine is already running, init immediately.
    if (this.ctx) module.init(this.ctx);
    return this;
  }

  unregister(id: string): void {
    const i = this.modules.findIndex((m) => m.id === id);
    if (i === -1) return;
    const [removed] = this.modules.splice(i, 1);
    removed.dispose();
  }

  init(ctx: GameContext): void {
    this.ctx = ctx;
    for (const m of this.modules) m.init(ctx);
    this.started = true;
  }

  /** Drive one frame. `rawDt` is the (clamped) real delta in seconds. */
  update(rawDt: number): void {
    if (!this.started) return;

    // Deterministic fixed-step logic.
    this.clock.advance(rawDt, (dt) => {
      for (const m of this.modules) m.fixedUpdate?.(dt);
    });

    // Variable per-frame pass - camera smoothing, visual interpolation.
    const alpha = this.clock.alpha;
    for (const m of this.modules) m.update(rawDt, alpha);
  }

  dispose(): void {
    // Reverse order so dependents tear down before their dependencies.
    for (let i = this.modules.length - 1; i >= 0; i--) {
      this.modules[i].dispose();
    }
    this.modules.length = 0;
    this.ctx = null;
    this.started = false;
    this.clock.reset();
  }
}
