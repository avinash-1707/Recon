"use client";

import { useRef } from "react";
import { useFrame } from "@react-three/fiber";
import * as THREE from "three";
import { peerViews } from "@/game/net/remotePeers";

// ---------------------------------------------------------------------------
// Auto-opening hinged door. Swings open when any player (local camera or a
// networked peer) approaches, eases shut when they leave. Purely visual — the
// doorway has no collider either way, so this never changes movement; it only
// replaces the old static door slab that was baked into the building's merged
// geometry. All animated doors in the town sit on Z-facing (front/back) walls,
// so the slab's width runs along X and its thickness along Z.
// ---------------------------------------------------------------------------

const OPEN_ANGLE = 1.65;   // ~95° — reads clearly as "open" without clipping far
const OPEN_DIST = 3.0;     // start opening within this many metres (horizontal)
const CLOSE_DIST = 4.4;    // swing shut again past this (hysteresis vs OPEN_DIST)
const SWING_LAMBDA = 7;    // exponential ease rate for the swing
const ACTIVE_RANGE = 55;   // skip the peer scan entirely past this distance

export interface DoorSpec {
  /** Door-opening centre, local to the parent building group. */
  center: [number, number, number];
  width: number;
  height: number;
  thickness?: number;
  /** Which side is exterior: +1 = +z face, -1 = -z face. Door swings inward. */
  facing?: 1 | -1;
  /** Hinge jamb: "left" (−x edge) or "right" (+x edge). */
  hinge?: "left" | "right";
}

export interface DoorProps extends DoorSpec {
  material: THREE.Material;
}

export function Door({
  center,
  width,
  height,
  thickness = 0.08,
  facing = 1,
  hinge = "left",
  material,
}: DoorProps) {
  const pivot = useRef<THREE.Group>(null);
  const angle = useRef(0);
  const worldPos = useRef<THREE.Vector3 | null>(null);

  // Hinge sits at one jamb; the slab spans from there across the opening, so
  // when closed (angle 0) it lands exactly where the old baked slab was.
  const hingeSign = hinge === "left" ? -1 : 1;
  const hingeX = center[0] + hingeSign * (width / 2);
  const slabX = -hingeSign * (width / 2);
  // Y-rotation sign that swings the free edge toward the interior (−facing·z).
  const openSign = facing * (hinge === "left" ? 1 : -1);
  // Handle on the free edge, exterior face.
  const handleX = slabX - hingeSign * (width * 0.38);
  const handleZ = facing * (thickness / 2 + 0.03);

  useFrame((state, dt) => {
    const g = pivot.current;
    if (!g) return;

    // Buildings never move — resolve the door's world position once.
    if (!worldPos.current) {
      worldPos.current = new THREE.Vector3();
      g.getWorldPosition(worldPos.current);
    }
    const wp = worldPos.current;

    const cam = state.camera.position;
    let nearest = Math.hypot(cam.x - wp.x, cam.z - wp.z);
    if (nearest < ACTIVE_RANGE) {
      for (const peer of peerViews.values()) {
        const p = peer.renderPos;
        const d = Math.hypot(p.x - wp.x, p.z - wp.z);
        if (d < nearest) nearest = d;
      }
    }

    // Hysteresis: once open, stay open out to CLOSE_DIST; once shut, only open
    // back inside OPEN_DIST. Keyed off whether we're past the halfway swing, so
    // the "open" latch trips mid-swing by design — a player loitering between
    // the two bands holds the door fully open rather than oscillating.
    const open =
      angle.current > OPEN_ANGLE * 0.5 ? nearest < CLOSE_DIST : nearest < OPEN_DIST;
    const target = open ? OPEN_ANGLE : 0;

    angle.current = THREE.MathUtils.damp(angle.current, target, SWING_LAMBDA, dt);
    g.rotation.y = openSign * angle.current;
  });

  return (
    <group ref={pivot} position={[hingeX, center[1], center[2]]}>
      <mesh position={[slabX, 0, 0]} material={material} castShadow receiveShadow>
        <boxGeometry args={[width, height, thickness]} />
      </mesh>
      {/* handle so the swing direction reads at a glance */}
      <mesh position={[handleX, 0, handleZ]} material={material}>
        <boxGeometry args={[0.06, 0.06, 0.1]} />
      </mesh>
    </group>
  );
}
