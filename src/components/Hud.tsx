"use client";

import { useEffect, useRef, useState } from "react";
import { usePlayerStore, Stance } from "@/game/state/playerStore";
import { useWeaponStore } from "@/game/state/weaponStore";
import { useHudStore, AlertLevel } from "@/game/state/hudStore";
import { WEAPONS } from "@/game/weapons/defs";
import { WeaponType, WEAPON_SLOTS } from "@/game/weapons/types";

const ACCENT = "#4cc9f0";
const WARN = "#f0a04c";
const DANGER = "#f04c4c";
const PANEL_BG = "rgba(8,12,16,0.55)";
const PANEL_BORDER = "1px solid rgba(255,255,255,0.10)";
const CLIP = "polygon(10px 0, 100% 0, 100% calc(100% - 10px), calc(100% - 10px) 100%, 0 100%, 0 10px)";

const SHORT: Record<WeaponType, string> = {
  [WeaponType.Pistol]: "M9",
  [WeaponType.AR]: "AR-15",
  [WeaponType.Sniper]: "SNIPER",
};

const label = { fontSize: "0.6rem", letterSpacing: "0.22em", opacity: 0.55, textTransform: "uppercase" as const };

/** Top-center stealth detection indicator. */
function DetectionMeter() {
  const detection = useHudStore((s) => s.detection);
  const alert = useHudStore((s) => s.alert);
  const color = alert === AlertLevel.Alerted ? DANGER : alert === AlertLevel.Suspicious ? WARN : ACCENT;
  const text = alert === AlertLevel.Alerted ? "DETECTED" : alert === AlertLevel.Suspicious ? "SUSPICIOUS" : "HIDDEN";
  return (
    <div style={{ position: "fixed", top: 18, left: "50%", transform: "translateX(-50%)", zIndex: 30, display: "flex", flexDirection: "column", alignItems: "center", gap: 5, pointerEvents: "none" }}>
      <div style={{ display: "flex", alignItems: "center", gap: 7, color, animation: alert === AlertLevel.Alerted ? "det-pulse 0.7s infinite" : undefined }}>
        <span style={{ fontSize: 13 }}>{alert === AlertLevel.Alerted ? "◆" : "◇"}</span>
        <span style={{ fontSize: "0.62rem", letterSpacing: "0.3em" }}>{text}</span>
      </div>
      <div style={{ width: 150, height: 3, background: "rgba(255,255,255,0.10)", borderRadius: 2, overflow: "hidden" }}>
        <div style={{ width: `${Math.round(detection * 100)}%`, height: "100%", background: color, transition: "width 90ms linear, background 200ms" }} />
      </div>
    </div>
  );
}

/** Top-right hostiles remaining. */
function EnemyCounter() {
  const alive = useHudStore((s) => s.enemiesAlive);
  const total = useHudStore((s) => s.enemiesTotal);
  return (
    <div style={{ position: "fixed", top: 16, right: 18, zIndex: 30, textAlign: "right", pointerEvents: "none" }}>
      <div style={label}>Hostiles</div>
      <div style={{ fontSize: "1.4rem", color: alive > 0 ? "#e7eef2" : ACCENT, lineHeight: 1 }}>
        {alive}
        <span style={{ fontSize: "0.8rem", opacity: 0.5 }}> / {total}</span>
      </div>
    </div>
  );
}

/** Bottom-left health. */
function HealthPanel() {
  const health = usePlayerStore((s) => s.health);
  const max = usePlayerStore((s) => s.maxHealth);
  const stance = usePlayerStore((s) => s.stance);
  const sprinting = usePlayerStore((s) => s.sprinting);
  const pct = Math.max(0, (health / max) * 100);
  const color = pct > 50 ? "#6fdc8c" : pct > 25 ? WARN : DANGER;
  return (
    <div style={{ position: "fixed", left: 18, bottom: 20, zIndex: 30, width: 230, padding: "10px 14px", background: PANEL_BG, border: PANEL_BORDER, clipPath: CLIP, backdropFilter: "blur(3px)", pointerEvents: "none" }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline" }}>
        <span style={label}>Vitals</span>
        <span style={{ fontSize: "0.6rem", opacity: 0.5 }}>
          {stance === Stance.Crouch ? "CROUCH" : sprinting ? "SPRINT" : "STAND"}
        </span>
      </div>
      <div style={{ display: "flex", alignItems: "center", gap: 8, marginTop: 4 }}>
        <span style={{ fontSize: "1.5rem", color, minWidth: 42 }}>{Math.ceil(health)}</span>
        <div style={{ flex: 1, height: 6, background: "rgba(255,255,255,0.10)", borderRadius: 3, overflow: "hidden" }}>
          <div style={{ width: `${pct}%`, height: "100%", background: color, transition: "width 160ms, background 200ms" }} />
        </div>
      </div>
    </div>
  );
}

/** Bottom-center weapon + ammo (the gamer-style readout). */
function WeaponPanel() {
  const current = useWeaponStore((s) => s.current);
  const ammo = useWeaponStore((s) => s.ammo[s.current]);
  const reloading = useWeaponStore((s) => s.reloading);
  const def = WEAPONS[current];
  const low = ammo.mag <= Math.max(1, Math.ceil(def.magSize * 0.2));

  return (
    <div style={{ position: "fixed", bottom: 20, left: "50%", transform: "translateX(-50%)", zIndex: 30, width: 320, padding: "10px 16px 12px", background: PANEL_BG, border: PANEL_BORDER, clipPath: CLIP, backdropFilter: "blur(3px)", pointerEvents: "none" }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline" }}>
        <span style={{ fontSize: "0.72rem", letterSpacing: "0.18em", color: ACCENT }}>{def.name.toUpperCase()}</span>
        <span style={{ ...label, color: def.automatic ? WARN : undefined }}>{def.automatic ? "● AUTO" : "○ SEMI"}</span>
      </div>

      <div style={{ display: "flex", alignItems: "flex-end", gap: 10, marginTop: 2 }}>
        <span style={{ fontSize: "2.5rem", lineHeight: 1, color: reloading ? WARN : low ? DANGER : "#eef4f7", fontVariantNumeric: "tabular-nums" }}>
          {String(ammo.mag).padStart(2, "0")}
        </span>
        <span style={{ fontSize: "1rem", opacity: 0.5, marginBottom: 4 }}>/ {ammo.reserve}</span>
        <span style={{ flex: 1 }} />
        <span style={{ fontSize: "0.58rem", opacity: 0.5, marginBottom: 6, textAlign: "right" }}>
          DMG {def.damage}
          <br />
          {def.rpm} RPM
        </span>
      </div>

      {/* reload bar (animates over the weapon's reload time) */}
      <div style={{ height: 3, marginTop: 6, background: "rgba(255,255,255,0.08)", borderRadius: 2, overflow: "hidden" }}>
        {reloading && (
          <div key={current} style={{ height: "100%", background: WARN, animation: `reload-fill ${def.reloadMs}ms linear forwards` }} />
        )}
      </div>

      {/* weapon slots */}
      <div style={{ display: "flex", gap: 6, marginTop: 8 }}>
        {[1, 2, 3].map((slot) => {
          const t = WEAPON_SLOTS[slot];
          const active = t === current;
          return (
            <div key={slot} style={{ flex: 1, textAlign: "center", padding: "3px 0", fontSize: "0.56rem", letterSpacing: "0.12em", border: `1px solid ${active ? ACCENT : "rgba(255,255,255,0.10)"}`, color: active ? ACCENT : "rgba(255,255,255,0.45)", background: active ? "rgba(76,201,240,0.10)" : "transparent" }}>
              {slot} {SHORT[t]}
            </div>
          );
        })}
      </div>
    </div>
  );
}

/** Red vignette: flashes on damage, steady pulse when critical. */
function DamageVignette() {
  const health = usePlayerStore((s) => s.health);
  const prev = useRef(health);
  const [flash, setFlash] = useState(0);

  useEffect(() => {
    if (health < prev.current) {
      setFlash(1);
      const t = setTimeout(() => setFlash(0), 90);
      prev.current = health;
      return () => clearTimeout(t);
    }
    prev.current = health;
  }, [health]);

  const critical = health > 0 && health < 30;
  return (
    <>
      <div style={{ position: "fixed", inset: 0, zIndex: 34, pointerEvents: "none", background: "radial-gradient(circle, transparent 50%, rgba(210,20,20,0.85) 110%)", opacity: flash, transition: "opacity 0.45s ease-out" }} />
      {critical && (
        <div style={{ position: "fixed", inset: 0, zIndex: 33, pointerEvents: "none", background: "radial-gradient(circle, transparent 55%, rgba(180,15,15,1) 120%)", animation: "danger-pulse 1.1s infinite" }} />
      )}
    </>
  );
}

/** Game-over overlay. */
function GameOver() {
  const health = usePlayerStore((s) => s.health);
  if (health > 0) return null;
  return (
    <div style={{ position: "fixed", inset: 0, zIndex: 80, display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", gap: "1rem", background: "rgba(5,7,10,0.78)", backdropFilter: "blur(3px)" }}>
      <div style={{ fontSize: "2rem", letterSpacing: "0.35em", color: DANGER }}>ELIMINATED</div>
      <button
        onClick={() => location.reload()}
        style={{ marginTop: "0.5rem", padding: "0.5rem 1.4rem", fontSize: "0.7rem", letterSpacing: "0.2em", color: "#dfe8ec", background: "transparent", border: `1px solid ${ACCENT}`, cursor: "pointer" }}
      >
        REDEPLOY
      </button>
    </div>
  );
}

/** Heads-up display root. Reads stores reactively (discrete events only — never per frame). */
export function Hud() {
  return (
    <>
      <DetectionMeter />
      <EnemyCounter />
      <HealthPanel />
      <WeaponPanel />
      <DamageVignette />
      <GameOver />
    </>
  );
}
