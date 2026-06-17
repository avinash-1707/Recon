"use client";

import { useRef, type ReactNode } from "react";
import { useFrame } from "@react-three/fiber";
import * as THREE from "three";
import { useSettingsStore } from "@/game/state/settingsStore";

/** Hysteresis band (m) so buildings sitting on the render-distance boundary
 *  don't flicker on/off as the player jitters across it. */
const HYSTERESIS = 8;

/**
 * Visibility gate for a static structure. Toggles its subtree `.visible` from
 * the camera's horizontal (XZ) distance to the structure centre, so distant
 * buildings stop costing draw calls AND shadow-map passes. With the far plane
 * at 200m and fog ending at 70m, every building in the forward cone used to
 * render even though fog hid it; this cuts that to a ring around the player.
 *
 * Rapier colliders in the subtree are untouched (physics tracks them
 * independently of Three visibility), so a culled building stays solid —
 * bullets and bodies still collide. Only rendering is gated.
 *
 * `radius` is the footprint half-extent: a building whose centre is just past
 * the render distance but whose near wall reaches the player must still draw,
 * so the effective show distance is renderDistance + radius.
 */
export function CulledGroup({
  cx,
  cz,
  radius = 10,
  children,
}: {
  cx: number;
  cz: number;
  radius?: number;
  children: ReactNode;
}) {
  const ref = useRef<THREE.Group>(null);
  const visibleRef = useRef(true);

  useFrame((state) => {
    const g = ref.current;
    if (!g) return;
    const cam = state.camera.position;
    const dist = Math.hypot(cam.x - cx, cam.z - cz);
    const limit = useSettingsStore.getState().renderDistance + radius;
    // Symmetric deadband around `limit`: reveal at `limit - band`, hide at
    // `limit + band`, so jitter at the boundary can't toggle every frame.
    const next = visibleRef.current
      ? dist <= limit + HYSTERESIS
      : dist <= limit - HYSTERESIS;
    if (next !== visibleRef.current) {
      visibleRef.current = next;
      g.visible = next;
    }
  });

  return <group ref={ref}>{children}</group>;
}
