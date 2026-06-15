"use client";

import { useEffect, useRef } from "react";
import { useFrame, useThree } from "@react-three/fiber";
import { useRapier } from "@react-three/rapier";
import type * as THREE from "three";
import type { Engine } from "@/game/core/engine";
import type { GameContext } from "@/game/core/types";
import { useWorldStore } from "@/game/state/worldStore";

/** Beyond this, treat the frame as a stall (tab switch) and don't feed the sim. */
const MAX_FRAME_DT = 0.1;

/**
 * Wires an Engine into the r3f render loop. Builds the GameContext from the
 * live Three.js + Rapier handles, inits the engine once, and drives it from a
 * single `useFrame`. Pause is read via a transient Zustand subscription (no
 * per-frame re-render). Must be called inside <Canvas> and inside <Physics>.
 */
export function useGameLoop(engine: Engine): void {
  const scene = useThree((s) => s.scene);
  const gl = useThree((s) => s.gl);
  const camera = useThree((s) => s.camera);
  const { world } = useRapier();
  const pausedRef = useRef(false);

  useEffect(() => {
    const ctx: GameContext = {
      scene,
      gl,
      camera: camera as THREE.PerspectiveCamera,
      world,
    };
    engine.init(ctx);

    pausedRef.current = useWorldStore.getState().paused;
    const unsub = useWorldStore.subscribe((s) => {
      pausedRef.current = s.paused;
    });

    return () => {
      unsub();
      engine.dispose();
    };
  }, [engine, scene, gl, camera, world]);

  useFrame((_, dt) => {
    if (pausedRef.current) return;
    engine.update(Math.min(dt, MAX_FRAME_DT));
  });
}
