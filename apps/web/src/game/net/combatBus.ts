import type * as THREE from "three";

/**
 * Minimal decoupling between the (mode-agnostic) WeaponSystem and the
 * multiplayer net layer. WeaponSystem emits each local shot here; the
 * NetworkSystem subscribes (only in multiplayer) to relay it as a tracer.
 * In single-player there are no subscribers, so this is a no-op.
 *
 * The vectors passed to emitLocalShot are reused/mutable — subscribers must
 * read them synchronously (which the NetworkSystem does).
 */
export interface LocalShot {
  origin: THREE.Vector3;
  dir: THREE.Vector3;
  tracerColor: number;
  weapon: string;
}

type ShotListener = (shot: LocalShot) => void;

const listeners = new Set<ShotListener>();

export function onLocalShot(listener: ShotListener): () => void {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
}

export function emitLocalShot(shot: LocalShot): void {
  for (const listener of listeners) listener(shot);
}
