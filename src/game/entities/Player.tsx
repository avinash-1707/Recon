"use client";

import { useEffect, useRef } from "react";
import {
  RigidBody,
  CapsuleCollider,
  useRapier,
  type RapierRigidBody,
} from "@react-three/rapier";
import { useEngine } from "@/game/core/engineContext";
import { PlayerController } from "@/game/entities/playerController";
import { CameraMode, usePlayerStore } from "@/game/state/playerStore";
import { PLAYER_SPAWN } from "@/game/levels/spawns";

const RADIUS = 0.34;
const HALF_HEIGHT = 0.51; // cylinder half-height → ~1.7m total standing capsule
const SPAWN: [number, number, number] = [PLAYER_SPAWN.x, PLAYER_SPAWN.y, PLAYER_SPAWN.z];

/**
 * Player physics body: a kinematic-position capsule driven by PlayerController.
 * No mesh yet — the FP viewmodel / TP body arrive in the weapon + camera phases.
 */
export function Player() {
  const engine = useEngine();
  const { world } = useRapier();
  const bodyRef = useRef<RapierRigidBody>(null);
  // Placeholder body — visible only in third person (real rig lands in Step 6).
  const showBody = usePlayerStore((s) => s.cameraMode) === CameraMode.ThirdPerson;

  useEffect(() => {
    const body = bodyRef.current;
    if (!body || body.numColliders() === 0) return;
    const collider = body.collider(0);
    const controller = new PlayerController(world, body, collider);
    engine.register(controller);
    return () => engine.unregister(controller.id);
  }, [engine, world]);

  return (
    <RigidBody
      ref={bodyRef}
      type="kinematicPosition"
      colliders={false}
      position={SPAWN}
      enabledRotations={[false, false, false]}
    >
      <CapsuleCollider args={[HALF_HEIGHT, RADIUS]} />
      <mesh visible={showBody} castShadow>
        <capsuleGeometry args={[RADIUS, HALF_HEIGHT * 2, 8, 16]} />
        <meshStandardMaterial color="#3a6ea5" roughness={0.6} metalness={0.1} />
      </mesh>
    </RigidBody>
  );
}
