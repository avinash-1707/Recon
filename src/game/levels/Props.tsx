"use client";

import { Instances, Instance, RoundedBox } from "@react-three/drei";
import { RigidBody, CuboidCollider, CylinderCollider } from "@react-three/rapier";
import { MAT } from "@/game/levels/materials";

interface Placed {
  pos: [number, number, number];
  yaw: number;
}

// Deterministic layout - clusters of cover around the compound.
const CRATES: ReadonlyArray<Placed> = [
  { pos: [-8, 0.45, -4], yaw: 0.2 },
  { pos: [-8.95, 0.45, -4], yaw: -0.1 },
  { pos: [-8.5, 1.35, -4], yaw: 0.4 },
  { pos: [-7, 0.45, -5.2], yaw: 0.8 },
  { pos: [2, 0.45, 2], yaw: 0.1 },
  { pos: [2.95, 0.45, 2], yaw: 0.0 },
  { pos: [2.5, 1.35, 2], yaw: 0.5 },
  { pos: [2, 0.45, 2.95], yaw: 0.3 },
  { pos: [9, 0.45, 5], yaw: -0.3 },
  { pos: [9.9, 0.45, 5.1], yaw: 0.2 },
  { pos: [-10, 0.45, 7], yaw: 0.6 },
  { pos: [-10.9, 0.45, 7], yaw: 0.1 },
  { pos: [-10.4, 1.35, 7], yaw: -0.2 },
  { pos: [-9, 0.45, 9], yaw: 0.9 },
];

const BARRELS: ReadonlyArray<[number, number, number]> = [
  [-6, 0.5, -6],
  [-5.3, 0.5, -6.4],
  [-5.7, 0.5, -5.4],
  [5, 0.5, -3],
  [5.6, 0.5, -3.5],
  [11, 0.5, 8],
  [11.6, 0.5, 8.3],
  [-12, 0.5, 2],
];

const BARRIERS: ReadonlyArray<Placed> = [
  { pos: [0, 0, 6], yaw: 0 },
  { pos: [3, 0, 6], yaw: 0 },
  { pos: [-4, 0, -1], yaw: Math.PI / 2 },
  { pos: [7, 0, 1], yaw: 0.3 },
  { pos: [-7, 0, 4], yaw: Math.PI / 2 },
];

const CRATE = 0.9;

/** Wooden crates - one InstancedMesh draw call, individual cuboid colliders. */
function Crates() {
  return (
    <>
      <Instances limit={CRATES.length} range={CRATES.length} castShadow receiveShadow>
        <boxGeometry args={[CRATE, CRATE, CRATE]} />
        <meshStandardMaterial color="#8a5a2b" roughness={0.85} metalness={0.05} />
        {CRATES.map((c, i) => (
          <Instance key={i} position={c.pos} rotation={[0, c.yaw, 0]} />
        ))}
      </Instances>
      <RigidBody type="fixed" colliders={false}>
        {CRATES.map((c, i) => (
          <CuboidCollider key={i} args={[CRATE / 2, CRATE / 2, CRATE / 2]} position={c.pos} rotation={[0, c.yaw, 0]} />
        ))}
      </RigidBody>
    </>
  );
}

/** Steel drums - instanced cylinders + cylinder colliders. */
function Barrels() {
  return (
    <>
      <Instances limit={BARRELS.length} range={BARRELS.length} castShadow receiveShadow>
        <cylinderGeometry args={[0.35, 0.35, 1.0, 16]} />
        <meshStandardMaterial color="#3f6e4a" roughness={0.5} metalness={0.45} />
        {BARRELS.map((p, i) => (
          <Instance key={i} position={p} />
        ))}
      </Instances>
      <RigidBody type="fixed" colliders={false}>
        {BARRELS.map((p, i) => (
          <CylinderCollider key={i} args={[0.5, 0.35]} position={p} />
        ))}
      </RigidBody>
    </>
  );
}

/** Beveled concrete barriers (cover). Few enough to be plain meshes. */
function Barriers() {
  return (
    <RigidBody type="fixed" colliders={false}>
      {BARRIERS.map((b, i) => (
        <group key={i} position={b.pos} rotation={[0, b.yaw, 0]}>
          <mesh position={[0, 0.125, 0]} material={MAT.barrier} castShadow receiveShadow>
            <boxGeometry args={[2, 0.25, 0.6]} />
          </mesh>
          <RoundedBox args={[1.8, 0.85, 0.4]} radius={0.08} smoothness={3} position={[0, 0.675, 0]} material={MAT.barrier} castShadow receiveShadow />
          <CuboidCollider args={[1, 0.55, 0.3]} position={[0, 0.55, 0]} />
        </group>
      ))}
    </RigidBody>
  );
}

export function CoverProps() {
  return (
    <>
      <Crates />
      <Barrels />
      <Barriers />
    </>
  );
}
