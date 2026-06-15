"use client";

import { useWeaponStore } from "@/game/state/weaponStore";
import { WEAPONS } from "@/game/weapons/defs";

/** Minimal hip-fire crosshair. Hidden while a scoped weapon is aimed (scope has its own reticle). */
export function Crosshair() {
  const current = useWeaponStore((s) => s.current);
  const ads = useWeaponStore((s) => s.ads);
  if (ads && WEAPONS[current].scope) return null;

  const line = {
    position: "absolute" as const,
    background: "rgba(220,235,240,0.85)",
    boxShadow: "0 0 2px rgba(0,0,0,0.8)",
  };
  const len = 9;
  const gap = 5;
  const thick = 2;

  return (
    <div
      style={{
        position: "fixed",
        left: "50%",
        top: "50%",
        width: 0,
        height: 0,
        zIndex: 40,
        pointerEvents: "none",
      }}
    >
      <div style={{ ...line, width: thick, height: len, left: -thick / 2, top: -gap - len }} />
      <div style={{ ...line, width: thick, height: len, left: -thick / 2, top: gap }} />
      <div style={{ ...line, width: len, height: thick, left: -gap - len, top: -thick / 2 }} />
      <div style={{ ...line, width: len, height: thick, left: gap, top: -thick / 2 }} />
      <div style={{ ...line, width: 2, height: 2, left: -1, top: -1, borderRadius: "50%" }} />
    </div>
  );
}
