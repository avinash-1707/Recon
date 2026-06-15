"use client";

import { useEffect } from "react";
import { useWorldStore } from "@/game/state/worldStore";

/**
 * Dev-only DOM overlay + hotkeys for testing the core loop.
 * Replaced by the real input system + HUD in later phases.
 *   `  → toggle Rapier collider debug
 *   P  → pause/resume the simulation
 */
export function DevControls() {
  const paused = useWorldStore((s) => s.paused);
  const debug = useWorldStore((s) => s.debugPhysics);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.code === "Backquote") {
        e.preventDefault();
        useWorldStore.getState().toggleDebugPhysics();
      } else if (e.code === "KeyP") {
        useWorldStore.getState().togglePaused();
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, []);

  return (
    <div
      style={{
        position: "fixed",
        left: 12,
        bottom: 12,
        display: "flex",
        flexDirection: "column",
        gap: 2,
        fontSize: "0.7rem",
        lineHeight: 1.5,
        opacity: 0.6,
        pointerEvents: "none",
        zIndex: 50,
      }}
    >
      <span>
        <kbd>`</kbd> physics debug: {debug ? "on" : "off"}
      </span>
      <span>
        <kbd>P</kbd> {paused ? "paused" : "running"}
      </span>
    </div>
  );
}
