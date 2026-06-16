"use client";

import * as THREE from "three";
import { RoundedBox } from "@react-three/drei";
import { RigidBody, CuboidCollider } from "@react-three/rapier";
import { MAT } from "@/game/levels/materials";

export interface BuildingProps {
  position: [number, number, number];
  /** Yaw in radians. */
  rotationY?: number;
  width: number;
  depth: number;
  height: number;
}

const WALL_T = 0.3;
const PLINTH_H = 0.4;
const DOOR_W = 1.8;
const DOOR_H = 2.5;

/** Visual box using a shared material (no per-mesh material allocation). */
function Box({
  size,
  position,
  material,
  rotation,
}: {
  size: [number, number, number];
  position: [number, number, number];
  material: THREE.Material;
  rotation?: [number, number, number];
}) {
  return (
    <mesh position={position} rotation={rotation} material={material} castShadow receiveShadow>
      <boxGeometry args={size} />
    </mesh>
  );
}

/**
 * Modular blocky-but-detailed building: stepped plinth, paneled walls with
 * recessed ribbon windows + accent trims, beveled corner pilasters, a passable
 * doorway (front), and a roof with a beveled parapet + rooftop AC unit. Physics
 * is a set of fixed cuboid colliders that leave the doorway open.
 */
export function Building({ position, rotationY = 0, width, depth, height: h }: BuildingProps) {
  const floorY = PLINTH_H;
  const wy = floorY + h / 2; // wall center
  const top = floorY + h;
  const sideW = (width - DOOR_W) / 2; // front wall segment width
  const halfW = width / 2;
  const halfD = depth / 2;
  const pilasterH = h + 0.6;

  const winY = floorY + h * 0.58;
  const corners: ReadonlyArray<[number, number]> = [
    [halfW - 0.1, halfD - 0.1],
    [-(halfW - 0.1), halfD - 0.1],
    [halfW - 0.1, -(halfD - 0.1)],
    [-(halfW - 0.1), -(halfD - 0.1)],
  ];

  return (
    <group position={position} rotation={[0, rotationY, 0]}>
      {/* ---------- visuals ---------- */}
      <Box size={[width + 0.5, PLINTH_H, depth + 0.5]} position={[0, PLINTH_H / 2, 0]} material={MAT.plinth} />

      {/* solid walls */}
      <Box size={[WALL_T, h, depth]} position={[-(halfW - WALL_T / 2), wy, 0]} material={MAT.concrete} />
      <Box size={[WALL_T, h, depth]} position={[halfW - WALL_T / 2, wy, 0]} material={MAT.concrete} />
      <Box size={[width, h, WALL_T]} position={[0, wy, -(halfD - WALL_T / 2)]} material={MAT.concrete} />

      {/* front wall with doorway */}
      <Box size={[sideW, h, WALL_T]} position={[-(halfW - sideW / 2), wy, halfD - WALL_T / 2]} material={MAT.concrete} />
      <Box size={[sideW, h, WALL_T]} position={[halfW - sideW / 2, wy, halfD - WALL_T / 2]} material={MAT.concrete} />
      <Box size={[DOOR_W, h - DOOR_H, WALL_T]} position={[0, floorY + DOOR_H + (h - DOOR_H) / 2, halfD - WALL_T / 2]} material={MAT.concrete} />
      {/* door reveal trim */}
      <Box size={[DOOR_W + 0.2, 0.15, WALL_T + 0.06]} position={[0, floorY + DOOR_H, halfD - WALL_T / 2]} material={MAT.accent} />

      {/* recessed ribbon windows + trims (back, left, right) */}
      <Box size={[width * 0.66, 0.95, 0.08]} position={[0, winY, -(halfD - 0.03)]} material={MAT.glass} />
      <Box size={[width * 0.7, 0.12, 0.1]} position={[0, winY + 0.6, -(halfD - 0.02)]} material={MAT.accent} />
      <Box size={[width * 0.7, 0.12, 0.1]} position={[0, winY - 0.6, -(halfD - 0.02)]} material={MAT.accent} />
      <Box size={[0.08, 0.95, depth * 0.6]} position={[-(halfW - 0.03), winY, 0]} material={MAT.glass} />
      <Box size={[0.08, 0.95, depth * 0.6]} position={[halfW - 0.03, winY, 0]} material={MAT.glass} />
      <Box size={[0.1, 0.12, depth * 0.64]} position={[-(halfW - 0.02), winY + 0.6, 0]} material={MAT.accent} />
      <Box size={[0.1, 0.12, depth * 0.64]} position={[halfW - 0.02, winY + 0.6, 0]} material={MAT.accent} />

      {/* beveled corner pilasters */}
      {corners.map(([cx, cz], i) => (
        <RoundedBox
          key={i}
          args={[0.55, pilasterH, 0.55]}
          radius={0.07}
          smoothness={3}
          position={[cx, floorY - 0.2 + pilasterH / 2, cz]}
          material={MAT.trim}
          castShadow
          receiveShadow
        />
      ))}

      {/* roof slab + beveled parapet */}
      <Box size={[width, 0.3, depth]} position={[0, top + 0.15, 0]} material={MAT.roof} />
      <RoundedBox args={[width + 0.1, 0.6, 0.28]} radius={0.06} smoothness={3} position={[0, top + 0.6, halfD - 0.14]} material={MAT.concreteDark} castShadow />
      <RoundedBox args={[width + 0.1, 0.6, 0.28]} radius={0.06} smoothness={3} position={[0, top + 0.6, -(halfD - 0.14)]} material={MAT.concreteDark} castShadow />
      <RoundedBox args={[0.28, 0.6, depth + 0.1]} radius={0.06} smoothness={3} position={[halfW - 0.14, top + 0.6, 0]} material={MAT.concreteDark} castShadow />
      <RoundedBox args={[0.28, 0.6, depth + 0.1]} radius={0.06} smoothness={3} position={[-(halfW - 0.14), top + 0.6, 0]} material={MAT.concreteDark} castShadow />

      {/* rooftop unit detail */}
      <Box size={[1.6, 0.9, 1.2]} position={[halfW * 0.35, top + 0.75, -halfD * 0.3]} material={MAT.ductMetal} />
      <mesh position={[halfW * 0.35, top + 1.35, -halfD * 0.3]} material={MAT.ductMetal} castShadow>
        <cylinderGeometry args={[0.22, 0.22, 0.45, 12]} />
      </mesh>

      {/* ---------- colliders (doorway left open) ---------- */}
      <RigidBody type="fixed" colliders={false}>
        <CuboidCollider args={[(width + 0.5) / 2, PLINTH_H / 2, (depth + 0.5) / 2]} position={[0, PLINTH_H / 2, 0]} />
        <CuboidCollider args={[WALL_T / 2, h / 2, depth / 2]} position={[-(halfW - WALL_T / 2), wy, 0]} />
        <CuboidCollider args={[WALL_T / 2, h / 2, depth / 2]} position={[halfW - WALL_T / 2, wy, 0]} />
        <CuboidCollider args={[width / 2, h / 2, WALL_T / 2]} position={[0, wy, -(halfD - WALL_T / 2)]} />
        <CuboidCollider args={[sideW / 2, h / 2, WALL_T / 2]} position={[-(halfW - sideW / 2), wy, halfD - WALL_T / 2]} />
        <CuboidCollider args={[sideW / 2, h / 2, WALL_T / 2]} position={[halfW - sideW / 2, wy, halfD - WALL_T / 2]} />
        <CuboidCollider args={[DOOR_W / 2, (h - DOOR_H) / 2, WALL_T / 2]} position={[0, floorY + DOOR_H + (h - DOOR_H) / 2, halfD - WALL_T / 2]} />
        <CuboidCollider args={[width / 2, 0.15, depth / 2]} position={[0, top + 0.15, 0]} />
      </RigidBody>
    </group>
  );
}
