import * as THREE from "three";
import { clone as cloneSkinned } from "three/examples/jsm/utils/SkeletonUtils.js";
import type { GameContext, GameModule } from "@/game/core/types";
import { SystemOrder } from "@/game/core/types";
import { EnemyAgent } from "@/game/ai/enemyAgent";
import { EnemyState } from "@/game/ai/fsm";
import { archetypeFor } from "@/game/ai/archetypes";
import { PATROL_ROUTES, ENEMY_SPAWNS } from "@/game/levels/spawns";
import { AlertLevel, useHudStore } from "@/game/state/hudStore";
import { disposeDecals } from "@/game/utils/decals";
import { TEST_MODE } from "@/game/systems/input";
import { playerRuntime } from "@/game/state/runtime";

const _pt = new THREE.Vector3();

/**
 * Spawns and drives all enemies. Clones the rigged Soldier model per spawn,
 * runs each agent's FSM in the fixed step, advances animation in the render
 * step, and aggregates the strongest detection + alert level to the HUD store.
 */
export class AISystem implements GameModule {
  readonly id = "system.ai";
  readonly order = SystemOrder.AI;

  private readonly agents: EnemyAgent[] = [];

  constructor(
    private readonly modelScene: THREE.Object3D,
    private readonly clips: THREE.AnimationClip[],
  ) {}

  init(ctx: GameContext): void {
    const routes = new Map(PATROL_ROUTES.map((r) => [r.id, r]));
    let n = 0;
    for (const spawn of ENEMY_SPAWNS) {
      const route = routes.get(spawn.routeId);
      if (!route || route.waypoints.length === 0) continue;
      const root = cloneSkinned(this.modelScene);
      root.scale.setScalar(1);
      // Deterministic, distinct start waypoint + a small ring offset so enemies
      // sharing a route never spawn or patrol on top of each other (fixes the
      // "two bots in one body" merge). Archetype varies per spawn.
      const k = spawn.startWaypoint;
      const ang = k * 2.39996; // golden-angle spread
      const offX = Math.cos(ang) * 1.6;
      const offZ = Math.sin(ang) * 1.6;
      const config = archetypeFor(n++);
      const agent = new EnemyAgent(
        ctx.world,
        ctx.rapier,
        ctx.scene,
        root,
        this.clips,
        route.waypoints,
        k,
        config,
        offX,
        offZ,
      );
      this.agents.push(agent);
    }
    useHudStore.getState().setEnemyCounts(this.agents.length, this.agents.length);

    if (TEST_MODE) {
      (window as unknown as { __ai?: unknown }).__ai = {
        alive: () => this.agents.filter((a) => !a.isDead).length,
        // Deterministic hit on the nearest live enemy (head or body) for headless tests.
        hitNearest: (headshot: boolean) => {
          let best: (typeof this.agents)[number] | null = null;
          let bd = Infinity;
          for (const a of this.agents) {
            if (a.isDead) continue;
            const d = a.position.distanceToSquared(playerRuntime.position);
            if (d < bd) {
              bd = d;
              best = a;
            }
          }
          if (!best) return null;
          _pt.set(best.position.x, headshot ? 1.7 : 1.0, best.position.z);
          const res = best.takeDamage(1000, _pt);
          useHudStore.getState().registerHit(res.headshot, res.killed);
          return res;
        },
      };
    }
  }

  fixedUpdate(dt: number): void {
    let maxDetection = 0;
    let anyCombat = false;
    let alive = 0;
    for (const a of this.agents) {
      a.fixedUpdate(dt);
      if (!a.isDead) alive++;
      if (a.detection > maxDetection) maxDetection = a.detection;
      if (a.state === EnemyState.Combat) anyCombat = true;
    }
    const alert = anyCombat
      ? AlertLevel.Alerted
      : maxDetection > 0.25
        ? AlertLevel.Suspicious
        : AlertLevel.Calm;
    const hud = useHudStore.getState();
    hud.setDetection(Math.min(1, maxDetection), alert);
    hud.setEnemyCounts(alive, this.agents.length);
  }

  update(dt: number, alpha: number): void {
    for (const a of this.agents) a.update(dt, alpha);
  }

  dispose(): void {
    for (const a of this.agents) a.dispose();
    this.agents.length = 0;
    disposeDecals();
  }
}
