"use client";

import { useEffect, useRef, useState } from "react";
import { usePlayerStore } from "@/game/state/playerStore";
import { useWeaponStore } from "@/game/state/weaponStore";
import { useHudStore, AlertLevel } from "@/game/state/hudStore";
import { respawnPlayer } from "@/game/systems/respawn";
import { useAppStore } from "@/game/state/appStore";
import { Scoreboard } from "@/components/Scoreboard";
import { WEAPONS } from "@/game/weapons/defs";

const ACCENT = "#cfe0e6";
const WARN = "#f0a04c";
const DANGER = "#e84a4a";
const SHADOW = "0 1px 3px rgba(0,0,0,0.9)";

/** Minimal top-center detection cue - only asserts itself once suspicious. */
function DetectionMeter() {
  const detection = useHudStore((s) => s.detection);
  const alert = useHudStore((s) => s.alert);
  if (alert === AlertLevel.Calm && detection < 0.02) return null;
  const color = alert === AlertLevel.Alerted ? DANGER : alert === AlertLevel.Suspicious ? WARN : ACCENT;
  const text = alert === AlertLevel.Alerted ? "DETECTED" : "SPOTTED";
  return (
    <div style={{ position: "fixed", top: 16, left: "50%", transform: "translateX(-50%)", zIndex: 30, display: "flex", flexDirection: "column", alignItems: "center", gap: 4, pointerEvents: "none" }}>
      <span style={{ fontSize: "0.6rem", letterSpacing: "0.28em", color, textShadow: SHADOW, animation: alert === AlertLevel.Alerted ? "det-pulse 0.7s infinite" : undefined }}>
        {text}
      </span>
      <div style={{ width: 110, height: 2, background: "rgba(255,255,255,0.12)" }}>
        <div style={{ width: `${Math.round(detection * 100)}%`, height: "100%", background: color, transition: "width 90ms linear" }} />
      </div>
    </div>
  );
}

/** Bottom-right ammo (COD-style): big mag, dim reserve, weapon name above. */
function AmmoReadout() {
  const current = useWeaponStore((s) => s.current);
  const ammo = useWeaponStore((s) => s.ammo[s.current]);
  const reloading = useWeaponStore((s) => s.reloading);
  const def = WEAPONS[current];
  const low = ammo.mag <= Math.max(1, Math.ceil(def.magSize * 0.2));
  return (
    <div style={{ position: "fixed", right: 26, bottom: 22, zIndex: 30, textAlign: "right", pointerEvents: "none", fontVariantNumeric: "tabular-nums" }}>
      <div style={{ fontSize: "0.62rem", letterSpacing: "0.18em", color: "rgba(220,232,236,0.7)", textShadow: SHADOW }}>
        {def.name.toUpperCase()}
        <span style={{ marginLeft: 8, opacity: 0.55 }}>{def.melee ? "MELEE" : def.automatic ? "AUTO" : "SEMI"}</span>
      </div>
      {def.melee ? (
        <div style={{ fontSize: "1.5rem", color: "#f2f6f8", textShadow: SHADOW, lineHeight: 1.2 }}>∞</div>
      ) : (
        <>
          <div style={{ display: "flex", alignItems: "baseline", justifyContent: "flex-end", gap: 6, lineHeight: 1, marginTop: 2 }}>
            <span style={{ fontSize: "2.1rem", color: reloading ? WARN : low ? DANGER : "#f2f6f8", textShadow: SHADOW }}>{ammo.mag}</span>
            <span style={{ fontSize: "0.95rem", color: "rgba(220,232,236,0.5)", textShadow: SHADOW }}>/ {ammo.reserve}</span>
          </div>
          <div style={{ height: 2, marginTop: 3, marginLeft: "auto", width: 96, background: "rgba(255,255,255,0.08)" }}>
            {reloading && <div key={current} style={{ height: "100%", background: WARN, animation: `reload-fill ${def.reloadMs}ms linear forwards` }} />}
          </div>
        </>
      )}
    </div>
  );
}

/** Bottom-left slim health. */
function HealthReadout() {
  const health = usePlayerStore((s) => s.health);
  const max = usePlayerStore((s) => s.maxHealth);
  const pct = Math.max(0, (health / max) * 100);
  const color = pct > 50 ? "#cfe0e6" : pct > 25 ? WARN : DANGER;
  return (
    <div style={{ position: "fixed", left: 26, bottom: 22, zIndex: 30, pointerEvents: "none" }}>
      <div style={{ display: "flex", alignItems: "baseline", gap: 8 }}>
        <span style={{ fontSize: "1.6rem", color, textShadow: SHADOW, lineHeight: 1 }}>{Math.ceil(health)}</span>
        <span style={{ fontSize: "0.55rem", letterSpacing: "0.2em", color: "rgba(220,232,236,0.5)", textShadow: SHADOW }}>HP</span>
      </div>
      <div style={{ width: 130, height: 3, marginTop: 4, background: "rgba(255,255,255,0.1)" }}>
        <div style={{ width: `${pct}%`, height: "100%", background: color, transition: "width 160ms, background 200ms" }} />
      </div>
    </div>
  );
}

/** Tiny top-right hostiles count. */
function EnemyCounter() {
  const alive = useHudStore((s) => s.enemiesAlive);
  const total = useHudStore((s) => s.enemiesTotal);
  return (
    <div style={{ position: "fixed", top: 16, right: 26, zIndex: 30, pointerEvents: "none", textAlign: "right" }}>
      <span style={{ fontSize: "0.55rem", letterSpacing: "0.2em", color: "rgba(220,232,236,0.5)", textShadow: SHADOW }}>HOSTILES </span>
      <span style={{ fontSize: "0.9rem", color: alive > 0 ? "#e7eef2" : "#6fdc8c", textShadow: SHADOW }}>{alive}</span>
      <span style={{ fontSize: "0.7rem", color: "rgba(220,232,236,0.4)" }}>/{total}</span>
    </div>
  );
}

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
      <div style={{ position: "fixed", inset: 0, zIndex: 34, pointerEvents: "none", background: "radial-gradient(circle, transparent 48%, rgba(210,20,20,0.9) 115%)", opacity: flash, transition: "opacity 0.45s ease-out" }} />
      {critical && <div style={{ position: "fixed", inset: 0, zIndex: 33, pointerEvents: "none", background: "radial-gradient(circle, transparent 55%, rgba(180,15,15,1) 120%)", animation: "danger-pulse 1.1s infinite" }} />}
    </>
  );
}

function GameOver() {
  const health = usePlayerStore((s) => s.health);
  const multiplayer = useAppStore((s) => s.mode === "multiplayer");

  // Single-player frees the cursor so the player can click Redeploy. Multiplayer
  // auto-respawns (NetworkSystem) — keep the pointer lock so it's seamless.
  useEffect(() => {
    if (!multiplayer && health <= 0 && document.pointerLockElement) {
      document.exitPointerLock();
    }
  }, [health, multiplayer]);

  if (health > 0) return null;

  const redeploy = () => {
    respawnPlayer(); // teleport to a random house + refill
    document.querySelector<HTMLCanvasElement>("#game-root canvas")?.requestPointerLock();
  };

  return (
    <div style={{ position: "fixed", inset: 0, zIndex: 80, display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", gap: "1rem", background: "rgba(5,7,10,0.78)", backdropFilter: "blur(3px)", pointerEvents: multiplayer ? "none" : "auto" }}>
      <div style={{ fontSize: "2rem", letterSpacing: "0.35em", color: DANGER }}>ELIMINATED</div>
      {multiplayer ? (
        <div style={{ marginTop: "0.5rem", fontSize: "0.7rem", letterSpacing: "0.25em", color: "rgba(220,232,236,0.7)" }}>
          RESPAWNING…
        </div>
      ) : (
        <button onClick={redeploy} style={{ marginTop: "0.5rem", padding: "0.6rem 1.6rem", fontSize: "0.7rem", letterSpacing: "0.2em", color: "#dfe8ec", background: "rgba(76,201,240,0.08)", border: "1px solid rgba(220,232,236,0.6)", cursor: "pointer" }}>
          REDEPLOY
        </button>
      )}
    </div>
  );
}

/** Minimal, COD-style heads-up display. Reads stores on discrete events only. */
export function Hud() {
  return (
    <>
      <DetectionMeter />
      <EnemyCounter />
      <HealthReadout />
      <AmmoReadout />
      <DamageVignette />
      <Scoreboard />
      <GameOver />
    </>
  );
}
