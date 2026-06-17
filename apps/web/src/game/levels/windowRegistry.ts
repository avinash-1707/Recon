import * as THREE from "three";

/**
 * Registry of window OPENINGS in world space, populated by every BreakableWindow
 * (whether the glass is intact or shattered — the hole persists). The player
 * controller queries it to vault through a window you're standing at and facing.
 */
export interface WindowOpening {
  id: number;
  /** Opening centre, world space. */
  center: THREE.Vector3;
  /** Unit normal of the wall plane (the through-axis), world space. */
  normal: THREE.Vector3;
  halfW: number;
  halfH: number;
  /** Break the glass (no-op if already broken). */
  shatter: () => void;
  isBroken: () => boolean;
}

const openings = new Map<number, WindowOpening>();
let nextId = 1;

export function registerWindow(o: Omit<WindowOpening, "id">): number {
  const id = nextId++;
  openings.set(id, { ...o, id });
  return id;
}

export function unregisterWindow(id: number): void {
  openings.delete(id);
}

export interface VaultTarget {
  opening: WindowOpening;
  /** Which side of the plane the player is on (sign of player·normal). */
  side: number;
}

const _d = new THREE.Vector3();
const _tan = new THREE.Vector3();

const MAX_PLANE_DIST = 0.9; // how close to the wall plane to allow a vault
const LATERAL_PAD = 0.1; // must be genuinely within the opening width
const VERT_PAD = 0.8; // a standing player can vault a chest-high sill
const MIN_FACING = 0.7; // must face into/out of the wall (~45°), not parallel

/**
 * Find the best window the player can vault through right now: close to the
 * plane, within the opening's extent, and roughly facing it. Cheap — only
 * called on a vault attempt (jump press), not every frame.
 */
export function findVaultTarget(
  pos: THREE.Vector3,
  forward: THREE.Vector3,
): VaultTarget | null {
  let best: VaultTarget | null = null;
  let bestScore = Infinity;
  for (const o of openings.values()) {
    _d.subVectors(pos, o.center);
    if (_d.lengthSq() > 9) continue; // >3m away — skip
    const along = _d.dot(o.normal);
    if (Math.abs(along) > MAX_PLANE_DIST) continue;
    // horizontal tangent perpendicular to the normal
    _tan.set(o.normal.z, 0, -o.normal.x);
    const tl = _tan.length();
    if (tl < 1e-4) continue;
    _tan.multiplyScalar(1 / tl);
    const lateral = _d.dot(_tan);
    if (Math.abs(lateral) > o.halfW + LATERAL_PAD) continue;
    const vert = pos.y - o.center.y;
    if (Math.abs(vert) > o.halfH + VERT_PAD) continue;
    if (Math.abs(forward.dot(o.normal)) < MIN_FACING) continue;
    const score = Math.abs(along) + Math.abs(lateral);
    if (score < bestScore) {
      bestScore = score;
      best = { opening: o, side: Math.sign(along) || 1 };
    }
  }
  return best;
}
