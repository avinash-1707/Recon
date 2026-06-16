"use client";

import { useEffect, useRef, useState } from "react";
import { RigidBody, CuboidCollider, type RapierCollider } from "@react-three/rapier";
import { registerHittable, unregisterHittable } from "@/game/systems/combat";
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
 * Translucent, see-through glass filling a wall opening. Has a thin collider
 * registered as hittable - shooting it shatters the pane (mesh + collider
 * removed), opening a hole you can then see and shoot through.
 */
export function BreakableWindow({ position, width, height, facing }: Props) {
  const [broken, setBroken] = useState(false);
  const colRef = useRef<RapierCollider>(null);

  const glass: [number, number, number] = facing === "z" ? [width, height, T] : [T, height, width];
  const col: [number, number, number] =
    facing === "z" ? [width / 2, height / 2, T / 2] : [T / 2, height / 2, width / 2];

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

  if (broken) return null;

  return (
    <group position={position}>
      <mesh material={MAT.windowGlass}>
        <boxGeometry args={glass} />
      </mesh>
      <RigidBody type="fixed" colliders={false}>
        <CuboidCollider ref={colRef} args={col} />
      </RigidBody>
    </group>
  );
}
