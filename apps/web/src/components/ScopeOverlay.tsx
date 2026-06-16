"use client";

import { useWeaponStore } from "@/game/state/weaponStore";
import { WEAPONS } from "@/game/weapons/defs";

/** Sniper scope: black vignette with a circular sight + reticle, shown while aiming a scoped weapon. */
export function ScopeOverlay() {
  const current = useWeaponStore((s) => s.current);
  const ads = useWeaponStore((s) => s.ads);
  if (!ads || !WEAPONS[current].scope) return null;

  return (
    <div style={{ position: "fixed", inset: 0, zIndex: 45, pointerEvents: "none" }}>
      {/* black mask with circular cutout */}
      <div
        style={{
          position: "absolute",
          inset: 0,
          background:
            "radial-gradient(circle at 50% 50%, rgba(0,0,0,0) 0 31vh, rgba(0,0,0,0.985) 32vh)",
        }}
      />
      {/* scope ring */}
      <div
        style={{
          position: "absolute",
          left: "50%",
          top: "50%",
          width: "64vh",
          height: "64vh",
          transform: "translate(-50%,-50%)",
          borderRadius: "50%",
          border: "2px solid rgba(0,0,0,0.9)",
          boxShadow: "inset 0 0 40px rgba(0,0,0,0.8)",
        }}
      />
      {/* crosshair */}
      <div style={{ position: "absolute", left: "50%", top: "50%", width: "62vh", height: 1, transform: "translate(-50%,-50%)", background: "rgba(20,20,20,0.85)" }} />
      <div style={{ position: "absolute", left: "50%", top: "50%", width: 1, height: "62vh", transform: "translate(-50%,-50%)", background: "rgba(20,20,20,0.85)" }} />
      <div style={{ position: "absolute", left: "50%", top: "50%", width: 5, height: 5, transform: "translate(-50%,-50%)", borderRadius: "50%", background: "#c0331f" }} />
    </div>
  );
}
