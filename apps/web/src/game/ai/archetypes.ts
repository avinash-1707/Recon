import { AI } from "@/game/ai/fsm";

/**
 * Per-enemy tuning so the bots aren't all identical. Each archetype overrides a
 * few of the shared AI values and carries a model tint. Detection/search/threshold
 * tuning stays shared (in AI) for consistent feel.
 */
export interface EnemyConfig {
  name: string;
  health: number;
  walkSpeed: number;
  runSpeed: number;
  visionRange: number;
  visionFovDeg: number;
  detectionGain: number;
  fireInterval: number;
  fireDamage: number;
  engageRange: number;
  maxHitRange: number;
  /** Hex colour blended into the soldier model so types read at a glance. */
  tint: number;
}

function make(o: Partial<EnemyConfig>): EnemyConfig {
  return {
    name: "rifleman",
    health: AI.health,
    walkSpeed: AI.walkSpeed,
    runSpeed: AI.runSpeed,
    visionRange: AI.visionRange,
    visionFovDeg: AI.visionFovDeg,
    detectionGain: AI.detectionGain,
    fireInterval: AI.fireInterval,
    fireDamage: AI.fireDamage,
    engageRange: AI.engageRange,
    maxHitRange: AI.maxHitRange,
    tint: 0x9aa0a6,
    ...o,
  };
}

/** Balanced default. */
export const RIFLEMAN = make({});
/** Fast, fragile, keen-eyed, trigger-happy at short range. */
export const SCOUT = make({
  name: "scout",
  health: 65,
  walkSpeed: 2.6,
  runSpeed: 6.2,
  visionRange: 30,
  visionFovDeg: 115,
  detectionGain: 2.1,
  fireInterval: 0.85,
  fireDamage: 7,
  engageRange: 11,
  tint: 0x5fae6e,
});
/** Slow, tanky, hits hard, slower to react. */
export const HEAVY = make({
  name: "heavy",
  health: 185,
  walkSpeed: 1.4,
  runSpeed: 3.2,
  visionRange: 22,
  fireInterval: 1.5,
  fireDamage: 14,
  engageRange: 15,
  tint: 0x9a5a3a,
});
/** Long-range, narrow cone, high damage, slow cadence. */
export const MARKSMAN = make({
  name: "marksman",
  health: 90,
  walkSpeed: 1.8,
  runSpeed: 4.0,
  visionRange: 40,
  visionFovDeg: 78,
  fireInterval: 1.9,
  fireDamage: 19,
  engageRange: 24,
  maxHitRange: 60,
  tint: 0x4a82c0,
});

/** Deterministic archetype mix by spawn index (~50% rifleman, 20% scout/heavy, 10% marksman). */
export function archetypeFor(index: number): EnemyConfig {
  const r = index % 10;
  if (r < 1) return MARKSMAN;
  if (r < 3) return SCOUT;
  if (r < 5) return HEAVY;
  return RIFLEMAN;
}
