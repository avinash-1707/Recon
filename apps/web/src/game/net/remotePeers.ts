import * as THREE from "three";
import type { PeerSnapshot } from "@recon/protocol";

/**
 * Non-reactive per-frame transform registry for remote players. The
 * NetworkSystem writes target transforms here as snapshots arrive; the
 * RemotePlayer components read + smooth toward them every frame. Kept out of
 * Zustand so 20 Hz snapshot updates never trigger React re-renders.
 */
export interface PeerView {
  id: string;
  /** Latest authoritative transform from the network. */
  targetPos: THREE.Vector3;
  targetYaw: number;
  pitch: number;
  health: number;
  weapon: string;
  /** Smoothed render transform (lerped toward target each frame). */
  renderPos: THREE.Vector3;
  renderYaw: number;
  /** Has renderPos been seeded yet (snap on first snapshot, smooth after). */
  seeded: boolean;
}

export const peerViews = new Map<string, PeerView>();

export function applyPeerSnapshot(s: PeerSnapshot): void {
  let view = peerViews.get(s.id);
  if (!view) {
    view = {
      id: s.id,
      targetPos: new THREE.Vector3(),
      targetYaw: 0,
      pitch: 0,
      health: 100,
      weapon: "pistol",
      renderPos: new THREE.Vector3(),
      renderYaw: 0,
      seeded: false,
    };
    peerViews.set(s.id, view);
  }
  view.targetPos.set(s.pos[0], s.pos[1], s.pos[2]);
  view.targetYaw = s.yaw;
  view.pitch = s.pitch;
  view.health = s.health;
  view.weapon = s.weapon;
}

export function removePeer(id: string): void {
  peerViews.delete(id);
}

export function clearPeers(): void {
  peerViews.clear();
}
