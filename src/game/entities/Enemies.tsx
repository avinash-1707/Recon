"use client";

import { useEffect } from "react";
import { useGLTF } from "@react-three/drei";
import { useEngine } from "@/game/core/engineContext";
import { AISystem } from "@/game/systems/ai";

const MODEL = "/models/Soldier.glb";

/**
 * Loads the rigged enemy model (Suspense-gated by the loading screen) and
 * registers the AI system, which clones it per spawn. The GLB ships idle/walk/
 * run clips used for velocity-driven animation blending.
 */
export function Enemies() {
  const engine = useEngine();
  const gltf = useGLTF(MODEL);

  useEffect(() => {
    const ai = new AISystem(gltf.scene, gltf.animations);
    engine.register(ai);
    return () => engine.unregister(ai.id);
  }, [engine, gltf]);

  return null;
}

useGLTF.preload(MODEL);
