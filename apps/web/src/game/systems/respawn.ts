import * as THREE from "three";
import { playerRuntime } from "@/game/state/runtime";
import { usePlayerStore } from "@/game/state/playerStore";
import { useWeaponStore } from "@/game/state/weaponStore";
import { HOUSE_POSITIONS } from "@/game/levels/layout";

const SPAWN_Y = 1.6; // drop onto the house floor

/**
 * Respawn the player inside a random house: queue a controller teleport, refill
 * health + ammo. Pointer-lock re-acquisition is handled by the caller (gesture).
 */
export function respawnPlayer(): void {
  const houses = HOUSE_POSITIONS;
  const h = houses.length ? houses[Math.floor(Math.random() * houses.length)] : new THREE.Vector3();
  playerRuntime.teleport = new THREE.Vector3(h.x, SPAWN_Y, h.z);
  usePlayerStore.getState().revive();
  useWeaponStore.getState().refillAmmo();
}
