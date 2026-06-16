"use client";

import { useRef } from "react";
import { useFrame } from "@react-three/fiber";
import type * as THREE from "three";
import { playerRuntime } from "@/game/state/runtime";
import { usePlayerStore } from "@/game/state/playerStore";
import { HOUSE_POSITIONS } from "@/game/levels/layout";

const HEAL = 40;
const RANGE = 1.9;
const RESPAWN = 25;
const SPIN = 0.5; // slow rotation (rad/s)

// Mostly inside houses, plus a few out in the open.
const SPOTS: ReadonlyArray<[number, number]> = [
  ...HOUSE_POSITIONS.slice(0, 6).map((v) => [v.x, v.z] as [number, number]),
  [0, 0],
  [22, 0],
  [-22, 0],
];

interface Slot {
  available: boolean;
  timer: number;
}

/** Slowly-rotating health kits. Walk over one (when hurt) to heal; respawns after a cooldown. */
export function HealthPickups() {
  const groups = useRef<Array<THREE.Group | null>>([]);
  const slots = useRef<Slot[]>(SPOTS.map(() => ({ available: true, timer: 0 })));
  const clock = useRef(0);

  useFrame((_, dt) => {
    clock.current += dt;
    const ps = usePlayerStore.getState();
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
      g.position.y = 0.9 + Math.sin(clock.current * 1.4 + i) * 0.1;

      const spot = SPOTS[i];
      const dx = spot[0] - playerRuntime.position.x;
      const dz = spot[1] - playerRuntime.position.z;
      if (dx * dx + dz * dz < RANGE * RANGE && ps.health < ps.maxHealth) {
        ps.heal(HEAL);
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
          position={[x, 0.9, z]}
        >
          <mesh castShadow>
            <boxGeometry args={[0.42, 0.42, 0.42]} />
            <meshStandardMaterial color="#eef3f5" emissive="#1f7a3c" emissiveIntensity={0.55} roughness={0.4} metalness={0.1} />
          </mesh>
          {[0.215, -0.215].map((zz, k) => (
            <group key={k} position={[0, 0, zz]}>
              <mesh>
                <boxGeometry args={[0.24, 0.08, 0.02]} />
                <meshBasicMaterial color="#19a34a" />
              </mesh>
              <mesh>
                <boxGeometry args={[0.08, 0.24, 0.02]} />
                <meshBasicMaterial color="#19a34a" />
              </mesh>
            </group>
          ))}
        </group>
      ))}
    </>
  );
}
