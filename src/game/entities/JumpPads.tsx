"use client";

import { useRef } from "react";
import { useFrame } from "@react-three/fiber";
import { playerRuntime } from "@/game/state/runtime";
import { PLOTS } from "@/game/levels/layout";

const LAUNCH = 21; // reaches ~9m — onto rooftops
const RADIUS = 1.3;

// A pad in the street beside a handful of buildings (centre-facing edge).
const PADS: ReadonlyArray<[number, number]> = PLOTS.filter((_, i) => i % 4 === 0)
  .slice(0, 6)
  .map((p) => {
    const len = Math.hypot(p.x, p.z) || 1;
    return [p.x - (p.x / len) * 7, p.z - (p.z / len) * 7] as [number, number];
  });

/** Bounce pads — step on one (grounded) to launch onto nearby rooftops. */
export function JumpPads() {
  const cooldown = useRef(0);

  useFrame((_, dt) => {
    if (cooldown.current > 0) cooldown.current -= dt;
    if (!playerRuntime.grounded || cooldown.current > 0) return;
    for (const [x, z] of PADS) {
      const dx = x - playerRuntime.position.x;
      const dz = z - playerRuntime.position.z;
      if (dx * dx + dz * dz < RADIUS * RADIUS) {
        playerRuntime.launch = LAUNCH;
        cooldown.current = 0.5;
        break;
      }
    }
  });

  return (
    <>
      {PADS.map(([x, z], i) => (
        <group key={i} position={[x, 0.06, z]}>
          <mesh rotation={[-Math.PI / 2, 0, 0]} receiveShadow>
            <circleGeometry args={[1.2, 28]} />
            <meshStandardMaterial color="#0a2a3a" emissive="#1f8fd0" emissiveIntensity={0.8} roughness={0.4} metalness={0.3} />
          </mesh>
          <mesh position={[0, 0.05, 0]} rotation={[-Math.PI / 2, 0, 0]}>
            <ringGeometry args={[0.85, 1.15, 28]} />
            <meshBasicMaterial color="#4cc9f0" />
          </mesh>
        </group>
      ))}
    </>
  );
}
