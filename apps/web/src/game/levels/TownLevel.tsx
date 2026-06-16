"use client";

import { useEffect, useMemo } from "react";
import * as THREE from "three";
import { Sky } from "@react-three/drei";
import { RigidBody, CuboidCollider } from "@react-three/rapier";
import { Building } from "@/game/levels/Building";
import { House } from "@/game/levels/House";
import { CoverProps } from "@/game/levels/Props";
import { MAT, disposeLevelMaterials } from "@/game/levels/materials";
import { PLOTS } from "@/game/levels/layout";
import { makeGroundTexture } from "@/game/utils/proceduralTextures";

const BORDER = 55; // perimeter wall radius
const GROUND = BORDER * 2 + 24;
const WALL_H = 5;
const WALL_T = 1.2;

/**
 * Enclosed town map (COD/PUBG TDM feel): four residential blocks of 1- and
 * 2-storey houses (plus a few warehouses) laid out on a 7x7 grid around the
 * central N-S/E-W avenues and plaza - 36 buildings, scattered cover, and a
 * closed perimeter wall. Static colliders.
 */
export default function TownLevel() {
  const groundTex = useMemo(() => makeGroundTexture(), []);
  const groundMat = useMemo(
    () => new THREE.MeshStandardMaterial({ map: groundTex, roughness: 0.97, metalness: 0 }),
    [groundTex],
  );

  useEffect(
    () => () => {
      groundTex.dispose();
      groundMat.dispose();
      disposeLevelMaterials();
    },
    [groundTex, groundMat],
  );

  return (
    <>
      <Sky distance={450000} sunPosition={[40, 28, 20]} turbidity={9} rayleigh={3} mieCoefficient={0.012} mieDirectionalG={0.82} />

      {/* ground */}
      <RigidBody type="fixed" colliders={false} friction={1}>
        <CuboidCollider args={[GROUND / 2, 0.5, GROUND / 2]} position={[0, -0.5, 0]} />
        <mesh rotation={[-Math.PI / 2, 0, 0]} receiveShadow material={groundMat}>
          <planeGeometry args={[GROUND, GROUND]} />
        </mesh>
      </RigidBody>

      {/* perimeter wall (closed border) */}
      <PerimeterWall />

      {/* buildings */}
      {PLOTS.map((p, i) => {
        if (p.kind === 2) {
          return <Building key={i} position={[p.x, 0, p.z]} rotationY={p.yaw} width={10} depth={8} height={7} />;
        }
        return (
          <House
            key={i}
            position={[p.x, 0, p.z]}
            rotationY={p.yaw}
            storeys={p.kind === 1 ? 2 : 1}
            width={p.kind === 1 ? 8 : 9}
            depth={p.kind === 1 ? 7 : 6}
            alt={p.alt}
          />
        );
      })}

      <CoverProps />
    </>
  );
}

function PerimeterWall() {
  const len = BORDER * 2 + WALL_T;
  return (
    <RigidBody type="fixed" colliders={false}>
      {/* visual + collider per side */}
      {([
        [0, BORDER, len, WALL_T],
        [0, -BORDER, len, WALL_T],
        [BORDER, 0, WALL_T, len],
        [-BORDER, 0, WALL_T, len],
      ] as const).map(([x, z, w, d], i) => (
        <group key={i}>
          <mesh position={[x, WALL_H / 2, z]} material={MAT.concreteDark} castShadow receiveShadow>
            <boxGeometry args={[w, WALL_H, d]} />
          </mesh>
          <mesh position={[x, WALL_H + 0.12, z]} material={MAT.trim}>
            <boxGeometry args={[w + 0.2, 0.3, d + 0.2]} />
          </mesh>
          <CuboidCollider args={[w / 2, WALL_H / 2, d / 2]} position={[x, WALL_H / 2, z]} />
        </group>
      ))}
      {/* corner posts */}
      {([
        [BORDER, BORDER],
        [-BORDER, BORDER],
        [BORDER, -BORDER],
        [-BORDER, -BORDER],
      ] as const).map(([x, z], i) => (
        <mesh key={`c${i}`} position={[x, WALL_H * 0.7, z]} material={MAT.trim} castShadow>
          <boxGeometry args={[2, WALL_H * 1.4, 2]} />
        </mesh>
      ))}
    </RigidBody>
  );
}
