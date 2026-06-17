"use client";

import { useEffect, useRef, useState } from "react";
import * as THREE from "three";
import { RigidBody, CuboidCollider, type RapierCollider } from "@react-three/rapier";
import { registerHittable, unregisterHittable } from "@/game/systems/combat";
import { registerWindow, unregisterWindow } from "@/game/levels/windowRegistry";
import { MAT } from "@/game/levels/materials";

interface Props {
  /** Centre of the window opening (house-local). */
  position: [number, number, number];
  width: number;
  height: number;
  facing: "z" | "x";
}

const T = 0.06;

/**
 * Translucent, see-through glass filling a wall opening. Shooting it shatters
 * the pane (mesh + collider removed), opening a hole you can see/shoot through.
 * The OPENING itself is registered in the window registry (persists after the
 * glass breaks) so the player can vault through it.
 */
export function BreakableWindow({ position, width, height, facing }: Props) {
  const [broken, setBroken] = useState(false);
  const colRef = useRef<RapierCollider>(null);
  const groupRef = useRef<THREE.Group>(null);
  const brokenRef = useRef(false);

  const glass: [number, number, number] = facing === "z" ? [width, height, T] : [T, height, width];
  const col: [number, number, number] =
    facing === "z" ? [width / 2, height / 2, T / 2] : [T / 2, height / 2, width / 2];

  useEffect(() => {
    brokenRef.current = broken;
  }, [broken]);

  // Register the opening (world space) for vaulting — independent of glass state.
  useEffect(() => {
    const g = groupRef.current;
    if (!g) return;
    const center = new THREE.Vector3();
    g.getWorldPosition(center);
    const q = new THREE.Quaternion();
    g.getWorldQuaternion(q);
    const normal = new THREE.Vector3(facing === "z" ? 0 : 1, 0, facing === "z" ? 1 : 0)
      .applyQuaternion(q)
      .normalize();
    const id = registerWindow({
      center,
      normal,
      halfW: width / 2,
      halfH: height / 2,
      shatter: () => setBroken(true),
      isBroken: () => brokenRef.current,
    });
    return () => unregisterWindow(id);
  }, [facing, width, height]);

  // Glass is hittable (shatter on shot) only while intact.
  useEffect(() => {
    if (broken) return;
    const c = colRef.current;
    if (!c) return;
    const handle = c.handle;
    registerHittable(handle, () => {
      setBroken(true);
      return { headshot: false, killed: false };
    });
    return () => unregisterHittable(handle);
  }, [broken]);

  // The group is always mounted (so the opening stays registered); only the
  // glass pane + its collider come and go.
  return (
    <group ref={groupRef} position={position}>
      {!broken && (
        <>
          <mesh material={MAT.windowGlass}>
            <boxGeometry args={glass} />
          </mesh>
          <RigidBody type="fixed" colliders={false}>
            <CuboidCollider ref={colRef} args={col} />
          </RigidBody>
        </>
      )}
    </group>
  );
}
