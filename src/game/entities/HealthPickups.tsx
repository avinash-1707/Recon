"use client";

import { useRef } from "react";
import { useFrame } from "@react-three/fiber";
import type * as THREE from "three";
import { playerRuntime } from "@/game/state/runtime";
import { usePlayerStore } from "@/game/state/playerStore";

const SPOTS: ReadonlyArray<[number, number]> = [
  [0, 0],
  [0, 22],
  [0, -22],
  [22, 0],
  [-22, 0],
  [33, 33],
  [-33, -33],
  [33, -33],
];

const HEAL = 40;
const RANGE = 1.9;
const RESPAWN = 25;

interface Slot {
  available: boolean;
  timer: number;
}

/**
 * Floating medkits. Walk over one (when hurt) to heal; it then respawns after a
 * cooldown. Bob/rotate animation runs on a local useFrame (visual only).
 */
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
      g.rotation.y += dt * 1.6;
      g.position.y = 1.0 + Math.sin(clock.current * 2 + i) * 0.12;

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
          position={[x, 1, z]}
        >
          <mesh castShadow>
            <boxGeometry args={[0.42, 0.42, 0.42]} />
            <meshStandardMaterial color="#eef3f5" emissive="#1f7a3c" emissiveIntensity={0.55} roughness={0.4} metalness={0.1} />
          </mesh>
          {/* red cross, both faces */}
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
