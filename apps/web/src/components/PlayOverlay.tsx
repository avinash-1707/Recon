"use client";

import { usePointerLock } from "@/hooks/usePointerLock";
import { useIsTouch } from "@/hooks/useIsTouch";
import { TEST_MODE, touch } from "@/game/systems/input";
import { usePlayerStore } from "@/game/state/playerStore";
import { useWorldStore } from "@/game/state/worldStore";

const KEYBOARD_CONTROLS: ReadonlyArray<[string, string]> = [
  ["WASD", "Move"],
  ["Shift", "Sprint"],
  ["Ctrl / C", "Crouch"],
  ["Space", "Jump"],
  ["LMB / RMB", "Fire / Aim"],
  ["1 / 2 / 3", "Pistol / AR / Sniper"],
  ["R", "Reload"],
  ["Esc", "Release cursor"],
];

const TOUCH_CONTROLS: ReadonlyArray<[string, string]> = [
  ["Left stick", "Move"],
  ["Right drag", "Look"],
  ["FIRE / AIM", "Shoot / ADS"],
  ["JUMP / CROUCH", "Jump / Crouch"],
  ["1-4", "Switch weapon"],
];

/**
 * Best-effort fullscreen + landscape lock for mobile. Both are gated behind a
 * user gesture and unsupported on some browsers (notably iOS Safari, which has
 * no orientation lock) - failures are swallowed; RotateOverlay handles the
 * fallback by prompting the user to rotate.
 */
async function enterLandscape(): Promise<void> {
  try {
    await document.documentElement.requestFullscreen?.();
  } catch {
    /* fullscreen denied - continue */
  }
  try {
    const orientation = screen.orientation as ScreenOrientation & {
      lock?: (o: string) => Promise<void>;
    };
    await orientation.lock?.("landscape");
  } catch {
    /* orientation lock unsupported - RotateOverlay will prompt */
  }
}

/** Click/tap-to-play overlay. Engages pointer lock (desktop) or touch play (mobile). */
export function PlayOverlay() {
  const { locked, request } = usePointerLock();
  const isTouch = useIsTouch();
  const touchPlaying = useWorldStore((s) => s.touchPlaying);
  const setTouchPlaying = useWorldStore((s) => s.setTouchPlaying);
  const dead = usePlayerStore((s) => s.health) <= 0;

  if (locked || touchPlaying || TEST_MODE || dead) return null;

  const start = () => {
    if (isTouch) {
      void enterLandscape();
      touch.setActive(true);
      setTouchPlaying(true);
    } else {
      request();
    }
  };

  const controls = isTouch ? TOUCH_CONTROLS : KEYBOARD_CONTROLS;

  return (
    <div
      onClick={start}
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
      <div style={{ fontSize: "1.1rem", letterSpacing: "0.2em", opacity: 0.9 }}>
        {isTouch ? "TAP TO PLAY" : "CLICK TO PLAY"}
      </div>
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
        {controls.map(([key, action]) => (
          <div key={key} style={{ display: "contents" }}>
            <span style={{ textAlign: "right", color: "var(--hud-accent)" }}>{key}</span>
            <span>{action}</span>
          </div>
        ))}
      </div>
    </div>
  );
}
