"use client";

import { useEffect, useRef } from "react";
import type * as THREE from "three";
import { RigidBody, CuboidCollider } from "@react-three/rapier";
import { RoundedBox } from "@react-three/drei";
import { useEngine } from "@/game/core/engineContext";
import type { GameContext, GameModule } from "@/game/core/types";

/**
 * TEMPORARY physics + loop proof. Replaced by the real building level in Step 5.
 *  - A fixed ground collider.
 *  - Dynamic crates that fall and settle  → proves Rapier fixed-step + render
 *    interpolation (smooth at any FPS, set by <Physics timeStep interpolate>).
 *  - A spinning beacon driven by the Engine's FixedClock → proves OUR fixed
 *    clock advances logic deterministically and interpolates the visual.
 */

/** Demo module: integrate rotation at a fixed rate, interpolate the render. */
class SpinBeaconModule implements GameModule {
  readonly id = "demo.spin-beacon";
  private prev = 0;
  private curr = 0;
  private readonly speed = Math.PI * 0.6; // rad/s

  constructor(private readonly mesh: THREE.Object3D) {}

  init(_ctx: GameContext): void {}

  fixedUpdate(dt: number): void {
    this.prev = this.curr;
    this.curr += this.speed * dt;
  }

  update(_dt: number, alpha: number): void {
    const angle = this.prev + (this.curr - this.prev) * alpha;
    this.mesh.rotation.set(angle * 0.5, angle, 0);
  }

  dispose(): void {}
}

function SpinBeacon() {
  const engine = useEngine();
  const ref = useRef<THREE.Mesh>(null);

  useEffect(() => {
    const mesh = ref.current;
    if (!mesh) return;
    const mod = new SpinBeaconModule(mesh);
    engine.register(mod);
    return () => engine.unregister(mod.id);
  }, [engine]);

  return (
    <mesh ref={ref} position={[0, 4.5, 0]} castShadow>
      <octahedronGeometry args={[0.5, 0]} />
      <meshStandardMaterial
        color="#4cc9f0"
        emissive="#0a4d63"
        emissiveIntensity={0.7}
        roughness={0.3}
        metalness={0.4}
      />
    </mesh>
  );
}

function Ground() {
  return (
    <RigidBody type="fixed" colliders={false} friction={1}>
      <CuboidCollider args={[30, 0.5, 30]} position={[0, -0.5, 0]} />
      <mesh rotation={[-Math.PI / 2, 0, 0]} receiveShadow>
        <planeGeometry args={[60, 60]} />
        <meshStandardMaterial color="#161b20" roughness={0.95} metalness={0.05} />
      </mesh>
    </RigidBody>
  );
}

const CRATES = Array.from({ length: 12 }, (_, i) => {
  const col = i % 4;
  const row = Math.floor(i / 4);
  return {
    key: i,
    pos: [(col - 1.5) * 1.35, 3 + row * 1.7, (row - 1) * 1.1] as [number, number, number],
  };
});

function FallingCrates() {
  return (
    <>
      {CRATES.map((c) => (
        <RigidBody key={c.key} colliders="cuboid" position={c.pos} restitution={0.08} friction={0.9}>
          <RoundedBox args={[1, 1, 1]} radius={0.06} smoothness={3} castShadow receiveShadow>
            <meshStandardMaterial color="#6b4a2b" roughness={0.85} metalness={0.05} />
          </RoundedBox>
        </RigidBody>
      ))}
    </>
  );
}

export default function SandboxLevel() {
  return (
    <>
      <Ground />
      <FallingCrates />
      <SpinBeacon />
    </>
  );
}
