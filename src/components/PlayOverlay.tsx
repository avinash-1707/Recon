"use client";

import { usePointerLock } from "@/hooks/usePointerLock";
import { TEST_MODE } from "@/game/systems/input";
import { usePlayerStore } from "@/game/state/playerStore";

const CONTROLS: ReadonlyArray<[string, string]> = [
  ["WASD", "Move"],
  ["Shift", "Sprint"],
  ["Ctrl / C", "Crouch"],
  ["Space", "Jump"],
  ["LMB / RMB", "Fire / Aim"],
  ["1 / 2 / 3", "Pistol / AR / Sniper"],
  ["R", "Reload"],
  ["Esc", "Release cursor"],
];

/** Click-to-play overlay. Engages pointer lock and lists the controls. */
export function PlayOverlay() {
  const { locked, request } = usePointerLock();
  const dead = usePlayerStore((s) => s.health) <= 0;
  if (locked || TEST_MODE || dead) return null;

  return (
    <div
      onClick={request}
      style={{
        position: "fixed",
        inset: 0,
        zIndex: 60,
        display: "flex",
        flexDirection: "column",
        alignItems: "center",
        justifyContent: "center",
        gap: "1.5rem",
        cursor: "pointer",
        background: "radial-gradient(120% 120% at 50% 40%, rgba(8,12,18,0.55) 0%, rgba(5,7,10,0.85) 80%)",
        backdropFilter: "blur(2px)",
      }}
    >
      <div style={{ fontSize: "0.7rem", letterSpacing: "0.5em", color: "var(--hud-accent)" }}>
        RECON
      </div>
      <div style={{ fontSize: "1.1rem", letterSpacing: "0.2em", opacity: 0.9 }}>CLICK TO PLAY</div>
      <div
        style={{
          display: "grid",
          gridTemplateColumns: "auto auto",
          columnGap: "1.25rem",
          rowGap: "0.35rem",
          fontSize: "0.78rem",
          opacity: 0.65,
        }}
      >
        {CONTROLS.map(([key, action]) => (
          <div key={key} style={{ display: "contents" }}>
            <span style={{ textAlign: "right", color: "var(--hud-accent)" }}>{key}</span>
            <span>{action}</span>
          </div>
        ))}
      </div>
    </div>
  );
}
