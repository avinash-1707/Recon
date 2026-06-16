"use client";

import { createContext, useContext, useRef, type ReactNode } from "react";
import { Engine } from "@/game/core/engine";
import { useGameLoop } from "@/hooks/useGameLoop";

const EngineContext = createContext<Engine | null>(null);

/**
 * Provides a single stable Engine instance to the subtree. Must live INSIDE
 * <Canvas> - r3f does not bridge React context across the canvas boundary.
 */
export function EngineProvider({ children }: { children: ReactNode }) {
  const ref = useRef<Engine | null>(null);
  if (!ref.current) ref.current = new Engine(1 / 60);
  return <EngineContext.Provider value={ref.current}>{children}</EngineContext.Provider>;
}

export function useEngine(): Engine {
  const engine = useContext(EngineContext);
  if (!engine) throw new Error("useEngine must be used within <EngineProvider>");
  return engine;
}

/**
 * Drives the engine's update loop. Render exactly once, inside <EngineProvider>
 * and inside <Physics> (so the Rapier world is available).
 */
export function EngineRunner() {
  const engine = useEngine();
  useGameLoop(engine);
  return null;
}
