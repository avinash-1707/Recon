"use client";

import { useRef } from "react";
import { useFrame } from "@react-three/fiber";
import type * as THREE from "three";
import { playerRuntime } from "@/game/state/runtime";
import { usePlayerStore } from "@/game/state/playerStore";
import { useWeaponStore } from "@/game/state/weaponStore";
import { HOUSE_POSITIONS } from "@/game/levels/layout";

const RANGE = 1.9;
const RESPAWN = 30;
const SPIN = 0.5;

// In houses that don't host health kits.
const SPOTS: ReadonlyArray<[number, number]> = HOUSE_POSITIONS.slice(6, 12).map(
  (v) => [v.x, v.z] as [number, number],
);

interface Slot {
  available: boolean;
  timer: number;
}

/** Ammo crates in houses — resupply all weapon reserves on pickup. */
export function AmmoPickups() {
  const groups = useRef<Array<THREE.Group | null>>([]);
  const slots = useRef<Slot[]>(SPOTS.map(() => ({ available: true, timer: 0 })));
  const clock = useRef(0);

  useFrame((_, dt) => {
    clock.current += dt;
    const dead = usePlayerStore.getState().health <= 0;
    for (let i = 0; i < SPOTS.length; i++) {
      const g = groups.current[i];
      const st = slots.current[i];
      if (!g) continue;
      if (!st.available) {
        st.timer -= dt;
        if (st.timer <= 0) st.available = true;
        g.visible = st.available;
        if (!st.available) continue;
      }
      g.visible = true;
      g.rotation.y += dt * SPIN;
      g.position.y = 0.75 + Math.sin(clock.current * 1.4 + i) * 0.08;

      if (dead) continue;
      const spot = SPOTS[i];
      const dx = spot[0] - playerRuntime.position.x;
      const dz = spot[1] - playerRuntime.position.z;
      if (dx * dx + dz * dz < RANGE * RANGE) {
        useWeaponStore.getState().refillAmmo();
        st.available = false;
        st.timer = RESPAWN;
        g.visible = false;
      }
    }
  });

  return (
    <>
      {SPOTS.map(([x, z], i) => (
        <group
          key={i}
          ref={(el) => {
            groups.current[i] = el;
          }}
          position={[x, 0.75, z]}
        >
          <mesh castShadow>
            <boxGeometry args={[0.5, 0.34, 0.36]} />
            <meshStandardMaterial color="#4a5230" emissive="#2a3a12" emissiveIntensity={0.25} roughness={0.7} metalness={0.15} />
          </mesh>
          {/* brass rounds on top */}
          {[-0.12, 0, 0.12].map((dx, k) => (
            <mesh key={k} position={[dx, 0.2, 0]} rotation={[0, 0, 0]}>
              <cylinderGeometry args={[0.035, 0.035, 0.16, 8]} />
              <meshStandardMaterial color="#d8a73a" metalness={0.8} roughness={0.3} />
            </mesh>
          ))}
        </group>
      ))}
    </>
  );
}
