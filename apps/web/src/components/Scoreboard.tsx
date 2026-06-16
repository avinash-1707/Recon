"use client";

import { useEffect, useState } from "react";
import { useAppStore } from "@/game/state/appStore";
import { useNetStore } from "@/game/state/netStore";
import type { PlayerMeta } from "@recon/protocol";

const ACCENT = "#4cc9f0";
const FG = "#d7e2e6";
const MUTED = "rgba(215,226,230,0.5)";
const SHADOW = "0 1px 3px rgba(0,0,0,0.9)";

function rank(players: PlayerMeta[]): PlayerMeta[] {
  return [...players].sort((a, b) => b.kills - a.kills || a.deaths - b.deaths);
}

/** Authed marker — a small filled dot, dim for guests. */
function AuthDot({ authed }: { authed: boolean }) {
  return (
    <span
      title={authed ? "signed in" : "guest"}
      style={{
        display: "inline-block",
        width: 5,
        height: 5,
        borderRadius: "50%",
        marginRight: 6,
        background: authed ? ACCENT : "rgba(215,226,230,0.25)",
        verticalAlign: "middle",
      }}
    />
  );
}

/** Live free-for-all scoreboard. Compact top-right by default; hold Tab to
 *  expand. Multiplayer only; never steals pointer/keyboard from the game. */
export function Scoreboard() {
  const multiplayer = useAppStore((s) => s.mode === "multiplayer");
  const players = useNetStore((s) => s.players);
  const selfId = useNetStore((s) => s.selfId);
  const [expanded, setExpanded] = useState(false);

  useEffect(() => {
    if (!multiplayer) return;
    const onDown = (e: KeyboardEvent) => {
      if (e.code === "Tab") {
        e.preventDefault();
        setExpanded(true);
      }
    };
    const onUp = (e: KeyboardEvent) => {
      if (e.code === "Tab") {
        e.preventDefault();
        setExpanded(false);
      }
    };
    window.addEventListener("keydown", onDown);
    window.addEventListener("keyup", onUp);
    return () => {
      window.removeEventListener("keydown", onDown);
      window.removeEventListener("keyup", onUp);
    };
  }, [multiplayer]);

  if (!multiplayer) return null;
  const ranked = rank(players);

  if (expanded) {
    return (
      <div
        style={{
          position: "fixed",
          inset: 0,
          zIndex: 60,
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          pointerEvents: "none",
        }}
      >
        <div
          style={{
            minWidth: 360,
            background: "rgba(5,7,10,0.86)",
            border: "1px solid rgba(76,201,240,0.25)",
            padding: "1.1rem 1.3rem",
            backdropFilter: "blur(3px)",
            fontVariantNumeric: "tabular-nums",
          }}
        >
          <div style={{ fontSize: "0.6rem", letterSpacing: "0.3em", color: ACCENT, textShadow: SHADOW, marginBottom: 12 }}>
            SCOREBOARD · FREE-FOR-ALL
          </div>
          <div style={{ display: "grid", gridTemplateColumns: "1fr auto auto", columnGap: "1.6rem", rowGap: "0.35rem", alignItems: "center" }}>
            <span style={{ fontSize: "0.5rem", letterSpacing: "0.2em", color: MUTED }}>PLAYER</span>
            <span style={{ fontSize: "0.5rem", letterSpacing: "0.2em", color: MUTED, textAlign: "right" }}>K</span>
            <span style={{ fontSize: "0.5rem", letterSpacing: "0.2em", color: MUTED, textAlign: "right" }}>D</span>
            {ranked.map((p) => {
              const self = p.id === selfId;
              const color = self ? ACCENT : FG;
              return (
                <Row key={p.id}>
                  <span style={{ color, textShadow: SHADOW }}>
                    <AuthDot authed={p.authed} />
                    {p.handle}
                    {self && <span style={{ color: MUTED, fontSize: "0.6rem", marginLeft: 6 }}>YOU</span>}
                  </span>
                  <span style={{ color, textAlign: "right", textShadow: SHADOW }}>{p.kills}</span>
                  <span style={{ color: MUTED, textAlign: "right", textShadow: SHADOW }}>{p.deaths}</span>
                </Row>
              );
            })}
          </div>
        </div>
      </div>
    );
  }

  return (
    <div
      style={{
        position: "fixed",
        top: 44,
        right: 26,
        zIndex: 30,
        pointerEvents: "none",
        textAlign: "right",
        fontVariantNumeric: "tabular-nums",
      }}
    >
      <div style={{ fontSize: "0.5rem", letterSpacing: "0.22em", color: MUTED, textShadow: SHADOW, marginBottom: 4 }}>
        FFA · TAB
      </div>
      {ranked.slice(0, 8).map((p) => {
        const self = p.id === selfId;
        return (
          <div key={p.id} style={{ fontSize: "0.72rem", color: self ? ACCENT : FG, textShadow: SHADOW, lineHeight: 1.5 }}>
            {p.handle}
            <span style={{ color: MUTED, marginLeft: 8 }}>
              {p.kills}<span style={{ opacity: 0.5 }}>/{p.deaths}</span>
            </span>
          </div>
        );
      })}
    </div>
  );
}

/** Groups the three grid cells of one row under a single React key. */
function Row({ children }: { children: React.ReactNode }) {
  return <>{children}</>;
}
