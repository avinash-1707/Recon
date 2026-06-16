"use client";

import { useEffect, useMemo, useRef } from "react";
import * as THREE from "three";
import { clone as cloneSkinned } from "three/examples/jsm/utils/SkeletonUtils.js";
import { useFrame } from "@react-three/fiber";
import { useGLTF } from "@react-three/drei";
import {
  CapsuleCollider,
  RigidBody,
  type RapierRigidBody,
} from "@react-three/rapier";
import {
  registerHittable,
  unregisterHittable,
  type HitInfo,
} from "@/game/systems/combat";
import { getSocket } from "@/game/net/socket";
import { peerViews } from "@/game/net/remotePeers";
import { useNetStore } from "@/game/state/netStore";

const MODEL = "/models/Soldier.glb";
const RADIUS = 0.34;
const HALF_HEIGHT = 0.51;
// Model feet sit at the capsule bottom (center - (halfHeight + radius)).
const MODEL_Y_OFFSET = -(HALF_HEIGHT + RADIUS);
// Soldier.glb faces +Z by default; yaw 0 faces -Z. (Visual-tune in polish.)
const MODEL_YAW_OFFSET = Math.PI;
const SMOOTH_RATE = 12;
const HEADSHOT_OVER_CENTER = 0.45;

function shortestAngle(from: number, to: number): number {
  let d = (to - from) % (Math.PI * 2);
  if (d > Math.PI) d -= Math.PI * 2;
  if (d < -Math.PI) d += Math.PI * 2;
  return d;
}

/** One remote player: a collidable kinematic capsule + cloned soldier model,
 *  smoothed toward the latest networked transform. Registers a hit handler so
 *  the local player's hitscan can damage it (relaying the hit to the server). */
function RemotePlayer({ id }: { id: string }) {
  const bodyRef = useRef<RapierRigidBody>(null);
  const modelRef = useRef<THREE.Group>(null);
  const gltf = useGLTF(MODEL);
  const model = useMemo(() => cloneSkinned(gltf.scene), [gltf.scene]);

  useEffect(() => {
    let handle: number | null = null;
    let raf = 0;
    // The collider attaches a tick after mount; retry until it exists so a peer
    // is never left permanently non-hittable.
    const register = () => {
      const body = bodyRef.current;
      if (!body || body.numColliders() === 0) {
        raf = requestAnimationFrame(register);
        return;
      }
      handle = body.collider(0).handle;
      const onHit = (damage: number, point: THREE.Vector3): HitInfo => {
        const headshot = point.y > body.translation().y + HEADSHOT_OVER_CENTER;
        getSocket().emit("hit", { targetId: id, damage, headshot });
        // killed is unknown locally — the victim decides death; report a
        // body/head hitmarker only.
        return { headshot, killed: false };
      };
      registerHittable(handle, onHit);
    };
    register();
    return () => {
      cancelAnimationFrame(raf);
      if (handle !== null) unregisterHittable(handle);
    };
  }, [id]);

  useFrame((_, dt) => {
    const body = bodyRef.current;
    const view = peerViews.get(id);
    if (!body || !view) return;

    if (!view.seeded) {
      view.renderPos.copy(view.targetPos);
      view.renderYaw = view.targetYaw;
      view.seeded = true;
    } else {
      const a = Math.min(1, dt * SMOOTH_RATE);
      view.renderPos.lerp(view.targetPos, a);
      view.renderYaw += shortestAngle(view.renderYaw, view.targetYaw) * a;
    }

    body.setNextKinematicTranslation(view.renderPos);
    if (modelRef.current) modelRef.current.rotation.y = view.renderYaw + MODEL_YAW_OFFSET;
  });

  return (
    <RigidBody
      ref={bodyRef}
      type="kinematicPosition"
      colliders={false}
      enabledRotations={[false, false, false]}
      position={[0, -100, 0]}
    >
      <CapsuleCollider args={[HALF_HEIGHT, RADIUS]} />
      <group ref={modelRef} position={[0, MODEL_Y_OFFSET, 0]}>
        <primitive object={model} />
      </group>
    </RigidBody>
  );
}

/** Renders every connected peer except the local player. */
export function RemotePlayers() {
  const players = useNetStore((s) => s.players);
  const selfId = useNetStore((s) => s.selfId);
  return (
    <>
      {players
        .filter((p) => p.id !== selfId)
        .map((p) => (
          <RemotePlayer key={p.id} id={p.id} />
        ))}
    </>
  );
}

useGLTF.preload(MODEL);
