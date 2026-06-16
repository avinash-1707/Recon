/** Enemy behaviour states. */
export enum EnemyState {
  Patrol = "patrol",
  Alert = "alert",
  Search = "search",
  Combat = "combat",
  Dead = "dead",
}

/** Shared AI tuning. */
export const AI = {
  walkSpeed: 1.9,
  runSpeed: 4.6,
  visionRange: 26,
  visionFovDeg: 100,
  eyeHeight: 1.6,
  /** Detection rises this much per second when the player is in view (scaled by closeness). */
  detectionGain: 1.6,
  /** Detection decays this much per second when the player is not visible. */
  detectionDecay: 0.5,
  /** Above this, the enemy is fully alerted → combat. */
  combatThreshold: 1.0,
  /** Below this, suspicion fades and the enemy returns to patrol. */
  calmThreshold: 0.05,
  /** Seconds to keep searching the last known position before giving up. */
  searchTime: 6,
  waypointRadius: 1.2,
  /** Combat fire cadence (s) and per-shot damage. */
  fireInterval: 1.1,
  fireDamage: 9,
  /** Hit chance falls off with distance. */
  maxHitRange: 40,
  health: 100,
} as const;
