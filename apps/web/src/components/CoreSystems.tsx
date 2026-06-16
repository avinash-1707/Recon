"use client";

import { useEffect } from "react";
import { useEngine } from "@/game/core/engineContext";
import { InputSystem } from "@/game/systems/input";
import { CameraSystem } from "@/game/systems/camera";

/**
 * Registers the always-on global systems (input, camera) with the engine.
 * Entity-scoped modules (player controller, weapons, enemies) register from
 * their own components. Update order is fixed by each module's `order`, not by
 * mount order, so this can sit anywhere inside the engine subtree.
 */
export function CoreSystems() {
  const engine = useEngine();

  useEffect(() => {
    const inputSystem = new InputSystem();
    const cameraSystem = new CameraSystem();
    engine.register(inputSystem);
    engine.register(cameraSystem);
    return () => {
      engine.unregister(cameraSystem.id);
      engine.unregister(inputSystem.id);
    };
  }, [engine]);

  return null;
}
