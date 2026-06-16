"use client";

import { useEffect, useRef, useState } from "react";
import { useWeaponStore } from "@/game/state/weaponStore";
import { useHudStore, type HitKind } from "@/game/state/hudStore";
import { WEAPONS } from "@/game/weapons/defs";

interface Marker {
  key: number;
  kind: HitKind;
  kill: boolean;
}

const CORNERS: ReadonlyArray<[number, number]> = [
  [1, 1],
  [-1, 1],
  [1, -1],
  [-1, -1],
];

/** Hip-fire crosshair + hitmarker (white body / red head, larger on kill). */
export function Crosshair() {
  const current = useWeaponStore((s) => s.current);
  const ads = useWeaponStore((s) => s.ads);
  const hitTick = useHudStore((s) => s.hitTick);
  const [marker, setMarker] = useState<Marker | null>(null);
  const timer = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);

  useEffect(() => {
    if (hitTick === 0) return;
    const { hitKind, hitKill } = useHudStore.getState();
    setMarker({ key: hitTick, kind: hitKind, kill: hitKill });
    clearTimeout(timer.current);
    timer.current = setTimeout(() => setMarker(null), 280);
    return () => clearTimeout(timer.current);
  }, [hitTick]);

  const scoped = ads && WEAPONS[current].scope;

  const line = {
    position: "absolute" as const,
    background: "rgba(220,235,240,0.85)",
    boxShadow: "0 0 2px rgba(0,0,0,0.8)",
  };
  const len = 9;
  const gap = 5;
  const thick = 2;

  return (
    <div style={{ position: "fixed", left: "50%", top: "50%", width: 0, height: 0, zIndex: 40, pointerEvents: "none" }}>
      {/* static crosshair (hidden under a sniper scope) */}
      {!scoped && (
        <>
          <div style={{ ...line, width: thick, height: len, left: -thick / 2, top: -gap - len }} />
          <div style={{ ...line, width: thick, height: len, left: -thick / 2, top: gap }} />
          <div style={{ ...line, width: len, height: thick, left: -gap - len, top: -thick / 2 }} />
          <div style={{ ...line, width: len, height: thick, left: gap, top: -thick / 2 }} />
          <div style={{ ...line, width: 2, height: 2, left: -1, top: -1, borderRadius: "50%" }} />
        </>
      )}

      {/* hitmarker */}
      {marker && <HitMarker key={marker.key} marker={marker} />}
    </div>
  );
}

function HitMarker({ marker }: { marker: Marker }) {
  const color = marker.kind === "head" ? "#ff3b30" : "#ffffff";
  const tick = marker.kill ? 13 : 9;
  const reach = marker.kill ? 7 : 6;
  return (
    <div
      style={{
        position: "absolute",
        left: 0,
        top: 0,
        animation: "hitmarker-pop 280ms ease-out forwards",
      }}
    >
      {CORNERS.map(([x, y], i) => (
        <div
          key={i}
          style={{
            position: "absolute",
            width: 2,
            height: tick,
            left: -1,
            top: -tick / 2,
            background: color,
            boxShadow: "0 0 3px rgba(0,0,0,0.9)",
            transform: `translate(${x * reach}px, ${y * reach}px) rotate(${x * y > 0 ? 45 : -45}deg)`,
          }}
        />
      ))}
    </div>
  );
}
