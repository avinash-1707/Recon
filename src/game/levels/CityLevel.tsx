"use client";

import { useEffect, useMemo } from "react";
import * as THREE from "three";
import { Sky } from "@react-three/drei";
import { RigidBody, CuboidCollider } from "@react-three/rapier";
import { Building } from "@/game/levels/Building";
import { CoverProps } from "@/game/levels/Props";
import { disposeLevelMaterials } from "@/game/levels/materials";
import { makeGroundTexture } from "@/game/utils/proceduralTextures";

const GROUND = 90;

/**
 * The playable compound: textured ground (with collider), a procedural sky,
 * several detailed modular buildings, and clustered cover props. Static — all
 * colliders are fixed bodies. Replaces the Step-2 sandbox.
 */
export default function CityLevel() {
  const groundTex = useMemo(() => makeGroundTexture(), []);
  const groundMat = useMemo(
    () => new THREE.MeshStandardMaterial({ map: groundTex, roughness: 0.97, metalness: 0 }),
    [groundTex],
  );

  // Dispose level-owned GPU resources on unmount.
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
      <Sky
        distance={450000}
        sunPosition={[10, 16, 8]}
        turbidity={9}
        rayleigh={3}
        mieCoefficient={0.012}
        mieDirectionalG={0.82}
      />

      {/* flat ground + collider */}
      <RigidBody type="fixed" colliders={false} friction={1}>
        <CuboidCollider args={[GROUND / 2, 0.5, GROUND / 2]} position={[0, -0.5, 0]} />
        <mesh rotation={[-Math.PI / 2, 0, 0]} receiveShadow material={groundMat}>
          <planeGeometry args={[GROUND, GROUND]} />
        </mesh>
      </RigidBody>

      {/* buildings */}
      <Building position={[-12, 0, -8]} width={8} depth={8} height={6} />
      <Building position={[11, 0, -11]} rotationY={-0.3} width={10} depth={7} height={7} />
      <Building position={[-15, 0, 9]} rotationY={0.2} width={7} depth={7} height={5} />
      <Building position={[14, 0, 7]} width={9} depth={8} height={6} />
      <Building position={[0, 0, -18]} width={6} depth={6} height={11} />

      <CoverProps />
    </>
  );
}
