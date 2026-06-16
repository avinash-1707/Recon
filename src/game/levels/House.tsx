"use client";

import { useEffect, useMemo } from "react";
import * as THREE from "three";
import { RigidBody, CuboidCollider } from "@react-three/rapier";
import { MAT } from "@/game/levels/materials";

export interface HouseProps {
  position: [number, number, number];
  rotationY?: number;
  storeys?: 1 | 2;
  width?: number;
  depth?: number;
  /** Alt plaster colour for variety. */
  alt?: boolean;
}

const STOREY_H = 2.7;
const WALL_T = 0.25;
const PLINTH_H = 0.35;
const DOOR_W = 1.1;
const DOOR_H = 2.1;
const EAVE = 0.45;

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

/** Framed punched window with glass, on a Z-facing or X-facing wall. */
function Win({
  pos,
  facing,
  w = 0.95,
  h = 1.15,
}: {
  pos: [number, number, number];
  facing: "z" | "x";
  w?: number;
  h?: number;
}) {
  const frame: [number, number, number] = facing === "z" ? [w + 0.18, h + 0.18, 0.1] : [0.1, h + 0.18, w + 0.18];
  const glass: [number, number, number] = facing === "z" ? [w, h, 0.05] : [0.05, h, w];
  return (
    <group position={pos}>
      <Box size={frame} position={[0, 0, 0]} material={MAT.woodTrim} />
      <Box size={glass} position={[0, 0, 0]} material={MAT.glass} />
    </group>
  );
}

/**
 * PUBG-style rural house: stone plinth, plastered walls, framed windows, a
 * front door (passable), a pitched gable roof with eaves + ridge cap, a
 * chimney, and (for 2-storey) a mid trim band. Perimeter wall colliders leave
 * the doorway open; a ceiling collider caps the room.
 */
export function House({ position, rotationY = 0, storeys = 1, width = 7, depth = 6, alt = false }: HouseProps) {
  const H = storeys * STOREY_H;
  const floorY = PLINTH_H;
  const wallTop = floorY + H;
  const halfW = width / 2;
  const halfD = depth / 2;
  const wallMat = alt ? MAT.plasterAlt : MAT.plaster;

  const ridgeRise = Math.min(width, depth) * 0.42;
  const ridgeY = wallTop + ridgeRise;
  const halfDe = halfD + EAVE;
  const slopeLen = Math.hypot(halfDe, ridgeRise);
  const theta = Math.atan2(ridgeRise, halfDe);
  const roofW = width + 2 * EAVE;
  const wy = floorY + H / 2;
  const sideW = (width - DOOR_W) / 2;

  // gable end triangles (both ends) as one geometry
  const gableGeo = useMemo(() => {
    const g = new THREE.BufferGeometry();
    const verts = new Float32Array([
      halfW, wallTop, -halfD, halfW, wallTop, halfD, halfW, ridgeY, 0,
      -halfW, wallTop, halfD, -halfW, wallTop, -halfD, -halfW, ridgeY, 0,
    ]);
    g.setAttribute("position", new THREE.BufferAttribute(verts, 3));
    g.computeVertexNormals();
    return g;
  }, [halfW, halfD, wallTop, ridgeY]);
  useEffect(() => () => gableGeo.dispose(), [gableGeo]);

  const winYs = storeys === 2 ? [floorY + 1.3, floorY + STOREY_H + 1.3] : [floorY + 1.4];

  return (
    <group position={position} rotation={[0, rotationY, 0]}>
      {/* plinth */}
      <Box size={[width + 0.4, PLINTH_H, depth + 0.4]} position={[0, PLINTH_H / 2, 0]} material={MAT.stoneBase} />

      {/* walls */}
      <Box size={[width, H, WALL_T]} position={[0, wy, -(halfD - WALL_T / 2)]} material={wallMat} />
      <Box size={[WALL_T, H, depth]} position={[-(halfW - WALL_T / 2), wy, 0]} material={wallMat} />
      <Box size={[WALL_T, H, depth]} position={[halfW - WALL_T / 2, wy, 0]} material={wallMat} />
      {/* front with doorway */}
      <Box size={[sideW, H, WALL_T]} position={[-(halfW - sideW / 2), wy, halfD - WALL_T / 2]} material={wallMat} />
      <Box size={[sideW, H, WALL_T]} position={[halfW - sideW / 2, wy, halfD - WALL_T / 2]} material={wallMat} />
      <Box size={[DOOR_W, H - DOOR_H, WALL_T]} position={[0, floorY + DOOR_H + (H - DOOR_H) / 2, halfD - WALL_T / 2]} material={wallMat} />

      {/* mid trim band (2-storey) */}
      {storeys === 2 && (
        <Box size={[width + 0.08, 0.16, depth + 0.08]} position={[0, floorY + STOREY_H, 0]} material={MAT.woodTrim} />
      )}

      {/* door */}
      <Box size={[DOOR_W, DOOR_H, 0.08]} position={[0, floorY + DOOR_H / 2, halfD - 0.02]} material={MAT.doorWood} />
      <Box size={[DOOR_W + 0.18, DOOR_H + 0.12, 0.12]} position={[0, floorY + DOOR_H / 2, halfD - WALL_T + 0.04]} material={MAT.woodTrim} />

      {/* windows */}
      {winYs.map((y, i) => (
        <group key={i}>
          <Win pos={[-width * 0.28, y, halfD - 0.02]} facing="z" />
          {y > floorY + STOREY_H ? <Win pos={[width * 0.28, y, halfD - 0.02]} facing="z" /> : null}
          <Win pos={[-width * 0.22, y, -(halfD - 0.02)]} facing="z" />
          <Win pos={[width * 0.22, y, -(halfD - 0.02)]} facing="z" />
          <Win pos={[-(halfW - 0.02), y, -depth * 0.2]} facing="x" />
          <Win pos={[halfW - 0.02, y, depth * 0.2]} facing="x" />
        </group>
      ))}

      {/* roof slopes + ridge + gables */}
      <mesh position={[0, (wallTop + ridgeY) / 2, halfDe / 2]} rotation={[theta, 0, 0]} material={MAT.roofShingle} castShadow receiveShadow>
        <boxGeometry args={[roofW, 0.14, slopeLen]} />
      </mesh>
      <mesh position={[0, (wallTop + ridgeY) / 2, -halfDe / 2]} rotation={[-theta, 0, 0]} material={MAT.roofShingle} castShadow receiveShadow>
        <boxGeometry args={[roofW, 0.14, slopeLen]} />
      </mesh>
      <Box size={[roofW, 0.18, 0.22]} position={[0, ridgeY + 0.03, 0]} material={MAT.roofShingle} />
      <mesh geometry={gableGeo} castShadow receiveShadow>
        <meshStandardMaterial color={alt ? "#b08d6a" : "#c7bfa6"} roughness={0.95} side={THREE.DoubleSide} />
      </mesh>

      {/* chimney */}
      <Box size={[0.5, ridgeRise + 0.9, 0.5]} position={[halfW * 0.45, wallTop + ridgeRise * 0.5, -halfD * 0.25]} material={MAT.chimney} />
      <Box size={[0.66, 0.18, 0.66]} position={[halfW * 0.45, wallTop + ridgeRise + 0.4, -halfD * 0.25]} material={MAT.stoneBase} />

      {/* colliders (doorway open, ceiling capped) */}
      <RigidBody type="fixed" colliders={false}>
        <CuboidCollider args={[(width + 0.4) / 2, PLINTH_H / 2, (depth + 0.4) / 2]} position={[0, PLINTH_H / 2, 0]} />
        <CuboidCollider args={[width / 2, H / 2, WALL_T / 2]} position={[0, wy, -(halfD - WALL_T / 2)]} />
        <CuboidCollider args={[WALL_T / 2, H / 2, depth / 2]} position={[-(halfW - WALL_T / 2), wy, 0]} />
        <CuboidCollider args={[WALL_T / 2, H / 2, depth / 2]} position={[halfW - WALL_T / 2, wy, 0]} />
        <CuboidCollider args={[sideW / 2, H / 2, WALL_T / 2]} position={[-(halfW - sideW / 2), wy, halfD - WALL_T / 2]} />
        <CuboidCollider args={[sideW / 2, H / 2, WALL_T / 2]} position={[halfW - sideW / 2, wy, halfD - WALL_T / 2]} />
        <CuboidCollider args={[DOOR_W / 2, (H - DOOR_H) / 2, WALL_T / 2]} position={[0, floorY + DOOR_H + (H - DOOR_H) / 2, halfD - WALL_T / 2]} />
        <CuboidCollider args={[halfW, 0.15, halfD]} position={[0, wallTop, 0]} />
      </RigidBody>
    </group>
  );
}
