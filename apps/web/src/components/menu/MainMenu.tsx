"use client";

import { useState, useEffect, useCallback } from "react";
import { useAppStore } from "@/game/state/appStore";
import { useNetStore } from "@/game/state/netStore";
import { createRoom, joinRoom, startMatch, leaveRoom } from "@/game/net/session";

// ---------------------------------------------------------------------------
// Design tokens — extend the existing HUD palette from globals.css
// ---------------------------------------------------------------------------
const ACCENT = "#4cc9f0";
const FG = "#d7e2e6";
const MUTED = "rgba(215,226,230,0.45)";
const WARN = "#f0a04c";
const DANGER = "#e84a4a";
const BG = "#05070a";
const SHADOW = "0 1px 3px rgba(0,0,0,0.9)";
const BORDER = "rgba(76,201,240,0.18)";
const BORDER_DIM = "rgba(215,226,230,0.10)";

// ---------------------------------------------------------------------------
// Style injection — keyframes + scan-line + grid pattern that can't be done inline
// ---------------------------------------------------------------------------
let styleInjected = false;
function ensureMenuStyles() {
  if (typeof document === "undefined" || styleInjected) return;
  styleInjected = true;
  const el = document.createElement("style");
  el.textContent = `
    @keyframes menu-fade-in {
      from { opacity: 0; transform: translateY(8px); }
      to   { opacity: 1; transform: translateY(0); }
    }
    @keyframes menu-slide-up {
      from { opacity: 0; transform: translateY(18px); }
      to   { opacity: 1; transform: translateY(0); }
    }
    @keyframes recon-title-glow {
      0%, 100% { text-shadow: 0 0 24px rgba(76,201,240,0.45), 0 0 2px rgba(76,201,240,0.8); }
      50%       { text-shadow: 0 0 48px rgba(76,201,240,0.7), 0 0 4px rgba(76,201,240,1); }
    }
    @keyframes scan-line {
      0%   { transform: translateY(-100%); }
      100% { transform: translateY(100vh); }
    }
    @keyframes cursor-blink {
      0%, 100% { opacity: 1; }
      50%       { opacity: 0; }
    }
    @keyframes spinner-rotate {
      from { transform: rotate(0deg); }
      to   { transform: rotate(360deg); }
    }
    @keyframes error-shake {
      0%, 100% { transform: translateX(0); }
      20%       { transform: translateX(-5px); }
      40%       { transform: translateX(5px); }
      60%       { transform: translateX(-3px); }
      80%       { transform: translateX(3px); }
    }
    @keyframes copy-flash {
      0%   { color: ${ACCENT}; }
      50%  { color: #6fdc8c; }
      100% { color: ${ACCENT}; }
    }
    .menu-btn {
      position: relative;
      overflow: hidden;
      cursor: pointer;
      transition: background 150ms, border-color 150ms, color 150ms, box-shadow 150ms;
    }
    .menu-btn::after {
      content: '';
      position: absolute;
      inset: 0;
      background: linear-gradient(to bottom, rgba(255,255,255,0.04), transparent);
      pointer-events: none;
    }
    .menu-btn:hover {
      box-shadow: 0 0 18px rgba(76,201,240,0.25);
    }
    .menu-btn-primary:hover {
      background: rgba(76,201,240,0.16) !important;
      border-color: rgba(76,201,240,0.5) !important;
    }
    .menu-btn-ghost:hover {
      background: rgba(215,226,230,0.06) !important;
      border-color: rgba(215,226,230,0.25) !important;
    }
    .menu-btn-danger:hover {
      background: rgba(240,76,76,0.12) !important;
      border-color: rgba(240,76,76,0.4) !important;
      color: ${DANGER} !important;
    }
    .menu-btn-success:hover {
      background: rgba(76,201,240,0.2) !important;
      border-color: ${ACCENT} !important;
      color: ${BG} !important;
      box-shadow: 0 0 22px rgba(76,201,240,0.45) !important;
    }
    .menu-input {
      background: rgba(5,7,10,0.7);
      border: 1px solid ${BORDER_DIM};
      color: ${FG};
      font-family: ui-monospace, "SF Mono", "Cascadia Code", Menlo, Consolas, monospace;
      font-size: 0.78rem;
      letter-spacing: 0.12em;
      outline: none;
      transition: border-color 140ms, box-shadow 140ms;
      width: 100%;
      box-sizing: border-box;
    }
    .menu-input::placeholder {
      color: rgba(215,226,230,0.22);
      letter-spacing: 0.08em;
    }
    .menu-input:focus {
      border-color: rgba(76,201,240,0.45);
      box-shadow: 0 0 0 1px rgba(76,201,240,0.12), inset 0 1px 3px rgba(0,0,0,0.4);
    }
    .menu-input:disabled {
      opacity: 0.4;
      cursor: not-allowed;
    }
    .code-input {
      text-transform: uppercase;
      letter-spacing: 0.35em;
      font-size: 1.1rem;
      text-align: center;
    }
  `;
  document.head.appendChild(el);
}

// ---------------------------------------------------------------------------
// Sub-components
// ---------------------------------------------------------------------------

function Spinner() {
  return (
    <div
      style={{
        width: 14,
        height: 14,
        border: "2px solid rgba(76,201,240,0.25)",
        borderTopColor: ACCENT,
        borderRadius: "50%",
        display: "inline-block",
        animation: "spinner-rotate 0.7s linear infinite",
        flexShrink: 0,
      }}
    />
  );
}

function SectionLabel({ children }: { children: React.ReactNode }) {
  return (
    <div
      style={{
        fontSize: "0.52rem",
        letterSpacing: "0.38em",
        color: MUTED,
        textShadow: SHADOW,
        textTransform: "uppercase",
        marginBottom: 8,
        display: "flex",
        alignItems: "center",
        gap: 8,
      }}
    >
      <div style={{ flex: 1, height: 1, background: "linear-gradient(to right, rgba(76,201,240,0.12), transparent)" }} />
      {children}
      <div style={{ flex: 1, height: 1, background: "linear-gradient(to left, rgba(76,201,240,0.12), transparent)" }} />
    </div>
  );
}

function ErrorBanner({ message, onDismiss }: { message: string; onDismiss: () => void }) {
  return (
    <div
      style={{
        padding: "8px 12px",
        background: "rgba(240,76,76,0.08)",
        border: `1px solid rgba(240,76,76,0.28)`,
        borderRadius: 3,
        display: "flex",
        alignItems: "flex-start",
        justifyContent: "space-between",
        gap: 8,
        animation: "error-shake 0.35s ease-out",
      }}
    >
      <span style={{ fontSize: "0.65rem", letterSpacing: "0.1em", color: DANGER, lineHeight: 1.4, textShadow: SHADOW }}>
        {message}
      </span>
      <button
        onClick={onDismiss}
        style={{
          background: "none",
          border: "none",
          cursor: "pointer",
          color: MUTED,
          fontSize: "0.7rem",
          padding: "0 2px",
          lineHeight: 1,
          flexShrink: 0,
          opacity: 0.7,
        }}
        aria-label="Dismiss error"
      >
        &#x2715;
      </button>
    </div>
  );
}

/** Decorative corner bracket — used to frame the main card */
function CornerBracket({ pos }: { pos: "tl" | "tr" | "bl" | "br" }) {
  const isTop = pos === "tl" || pos === "tr";
  const isLeft = pos === "tl" || pos === "bl";
  const size = 16;
  return (
    <div
      aria-hidden="true"
      style={{
        position: "absolute",
        top: isTop ? 0 : undefined,
        bottom: isTop ? undefined : 0,
        left: isLeft ? 0 : undefined,
        right: isLeft ? undefined : 0,
        width: size,
        height: size,
        borderTop: isTop ? `1px solid ${ACCENT}` : "none",
        borderBottom: isTop ? "none" : `1px solid ${ACCENT}`,
        borderLeft: isLeft ? `1px solid ${ACCENT}` : "none",
        borderRight: isLeft ? "none" : `1px solid ${ACCENT}`,
        opacity: 0.7,
      }}
    />
  );
}

// ---------------------------------------------------------------------------
// Screen: Landing
// ---------------------------------------------------------------------------
function LandingScreen({
  onSinglePlayer,
  onMultiplayer,
}: {
  onSinglePlayer: () => void;
  onMultiplayer: () => void;
}) {
  return (
    <div
      style={{
        display: "flex",
        flexDirection: "column",
        alignItems: "center",
        justifyContent: "center",
        flex: 1,
        gap: 0,
        animation: "menu-fade-in 0.5s ease-out forwards",
      }}
    >
      {/* Classification badge */}
      <div
        style={{
          fontSize: "0.5rem",
          letterSpacing: "0.55em",
          color: "rgba(76,201,240,0.45)",
          marginBottom: 24,
          textShadow: SHADOW,
          borderTop: `1px solid rgba(76,201,240,0.18)`,
          borderBottom: `1px solid rgba(76,201,240,0.18)`,
          padding: "5px 16px",
        }}
      >
        CLASSIFIED / TACTICAL ENGAGEMENT
      </div>

      {/* Game title */}
      <h1
        style={{
          fontSize: "clamp(4rem, 12vw, 8rem)",
          fontWeight: 900,
          letterSpacing: "0.22em",
          color: ACCENT,
          lineHeight: 1,
          textTransform: "uppercase",
          animation: "recon-title-glow 3.5s ease-in-out infinite",
          margin: 0,
          textShadow: `0 0 24px rgba(76,201,240,0.45), 0 0 2px rgba(76,201,240,0.8)`,
          fontFamily: "ui-monospace, 'SF Mono', 'Cascadia Code', Menlo, Consolas, monospace",
          fontStretch: "condensed",
        }}
      >
        RECON
      </h1>

      {/* Tagline */}
      <p
        style={{
          fontSize: "0.62rem",
          letterSpacing: "0.42em",
          color: MUTED,
          textShadow: SHADOW,
          marginTop: 12,
          marginBottom: 56,
        }}
      >
        SHADOW OPS PROTOCOL
      </p>

      {/* Action buttons */}
      <div
        style={{
          display: "flex",
          flexDirection: "column",
          gap: 10,
          width: 260,
          animation: "menu-slide-up 0.55s 0.12s ease-out both",
        }}
      >
        <button
          className="menu-btn menu-btn-primary"
          onClick={onSinglePlayer}
          style={{
            padding: "14px 0",
            fontSize: "0.65rem",
            letterSpacing: "0.32em",
            color: ACCENT,
            background: "rgba(76,201,240,0.08)",
            border: `1px solid rgba(76,201,240,0.28)`,
            borderRadius: 2,
            textTransform: "uppercase",
          }}
        >
          Single Player
        </button>

        <button
          className="menu-btn menu-btn-ghost"
          onClick={onMultiplayer}
          style={{
            padding: "14px 0",
            fontSize: "0.65rem",
            letterSpacing: "0.32em",
            color: FG,
            background: "rgba(215,226,230,0.04)",
            border: `1px solid ${BORDER_DIM}`,
            borderRadius: 2,
            textTransform: "uppercase",
          }}
        >
          Multiplayer
        </button>
      </div>

      {/* Version watermark */}
      <div
        style={{
          position: "absolute",
          bottom: 24,
          right: 28,
          fontSize: "0.48rem",
          letterSpacing: "0.25em",
          color: "rgba(215,226,230,0.18)",
          textShadow: SHADOW,
        }}
      >
        v0.1.0 — ALPHA
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Screen: Multiplayer Setup
// ---------------------------------------------------------------------------
function MultiplayerSetup({
  onBack,
}: {
  onBack: () => void;
}) {
  const phase = useNetStore((s) => s.phase);
  const handle = useNetStore((s) => s.handle);
  const error = useNetStore((s) => s.error);
  const setHandle = useNetStore((s) => s.setHandle);
  const setError = useNetStore((s) => s.setError);

  const [joinCode, setJoinCode] = useState("");
  const [activeTab, setActiveTab] = useState<"create" | "join">("create");

  const busy = phase === "connecting";

  // Validation helpers
  const trimmedHandle = handle.trim();
  const handleValid = trimmedHandle.length >= 1 && trimmedHandle.length <= 24;
  const trimmedCode = joinCode.trim().toUpperCase();
  const codeValid = trimmedCode.length === 6;

  const handleCreate = useCallback(async () => {
    if (!handleValid || busy) return;
    setError(null);
    try {
      await createRoom(trimmedHandle);
    } catch (e) {
      useNetStore.getState().setError(e instanceof Error ? e.message : "failed to create room");
    }
  }, [handleValid, busy, trimmedHandle, setError]);

  const handleJoin = useCallback(async () => {
    if (!handleValid || !codeValid || busy) return;
    setError(null);
    try {
      await joinRoom(trimmedCode, trimmedHandle);
    } catch (e) {
      useNetStore.getState().setError(e instanceof Error ? e.message : "failed to join room");
    }
  }, [handleValid, codeValid, busy, trimmedCode, trimmedHandle, setError]);

  return (
    <div
      style={{
        display: "flex",
        flexDirection: "column",
        alignItems: "center",
        justifyContent: "center",
        flex: 1,
        animation: "menu-fade-in 0.35s ease-out forwards",
      }}
    >
      <div
        style={{
          position: "relative",
          width: "min(400px, 90vw)",
          background: "linear-gradient(145deg, rgba(10,16,22,0.97) 0%, rgba(5,7,10,0.97) 100%)",
          border: `1px solid ${BORDER}`,
          borderRadius: 4,
          boxShadow: `0 0 0 1px rgba(5,7,10,0.5), 0 24px 60px rgba(0,0,0,0.85), 0 0 40px rgba(76,201,240,0.05)`,
          backdropFilter: "blur(12px)",
          overflow: "hidden",
        }}
      >
        <CornerBracket pos="tl" />
        <CornerBracket pos="tr" />
        <CornerBracket pos="bl" />
        <CornerBracket pos="br" />

        {/* Header */}
        <div
          style={{
            padding: "18px 22px 14px",
            borderBottom: `1px solid rgba(76,201,240,0.10)`,
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
          }}
        >
          <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
            <div
              style={{
                width: 6,
                height: 6,
                background: ACCENT,
                borderRadius: "50%",
                boxShadow: `0 0 6px rgba(76,201,240,0.8)`,
              }}
            />
            <span style={{ fontSize: "0.55rem", letterSpacing: "0.38em", color: ACCENT, textShadow: SHADOW }}>
              MULTIPLAYER
            </span>
          </div>
          <button
            onClick={onBack}
            disabled={busy}
            style={{
              background: "none",
              border: "none",
              cursor: busy ? "not-allowed" : "pointer",
              color: MUTED,
              fontSize: "0.6rem",
              letterSpacing: "0.2em",
              opacity: busy ? 0.3 : 0.6,
              padding: "2px 4px",
              transition: "opacity 120ms",
            }}
          >
            &larr; BACK
          </button>
        </div>

        {/* Body */}
        <div style={{ padding: "20px 22px", display: "flex", flexDirection: "column", gap: 18 }}>
          {/* Handle input */}
          <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
            <label
              htmlFor="menu-handle"
              style={{ fontSize: "0.52rem", letterSpacing: "0.3em", color: MUTED, textShadow: SHADOW }}
            >
              CALL SIGN
            </label>
            <input
              id="menu-handle"
              className="menu-input"
              type="text"
              placeholder="enter your handle..."
              value={handle}
              maxLength={24}
              disabled={busy}
              autoComplete="off"
              autoCorrect="off"
              spellCheck={false}
              onChange={(e) => {
                setHandle(e.target.value);
                if (error) setError(null);
              }}
              style={{ padding: "9px 12px", borderRadius: 2 }}
            />
            <div style={{ fontSize: "0.48rem", letterSpacing: "0.18em", color: "rgba(215,226,230,0.22)", textAlign: "right" }}>
              {handle.trim().length}/24
            </div>
          </div>

          {/* Tab switcher */}
          <div style={{ display: "flex", gap: 0, borderRadius: 2, overflow: "hidden", border: `1px solid ${BORDER_DIM}` }}>
            {(["create", "join"] as const).map((tab) => (
              <button
                key={tab}
                onClick={() => { setActiveTab(tab); if (error) setError(null); }}
                disabled={busy}
                style={{
                  flex: 1,
                  padding: "8px 0",
                  fontSize: "0.55rem",
                  letterSpacing: "0.28em",
                  color: activeTab === tab ? ACCENT : MUTED,
                  background: activeTab === tab ? "rgba(76,201,240,0.08)" : "transparent",
                  border: "none",
                  borderBottom: activeTab === tab ? `1px solid ${ACCENT}` : "1px solid transparent",
                  cursor: busy ? "not-allowed" : "pointer",
                  transition: "color 120ms, background 120ms",
                  fontFamily: "inherit",
                  textTransform: "uppercase",
                }}
              >
                {tab === "create" ? "Create Room" : "Join Room"}
              </button>
            ))}
          </div>

          {/* Tab content */}
          {activeTab === "create" ? (
            <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
              <p style={{ fontSize: "0.58rem", color: MUTED, letterSpacing: "0.08em", lineHeight: 1.6, textShadow: SHADOW }}>
                Start a new private room. Share the room code with your squad to let them join.
              </p>
              <button
                className="menu-btn menu-btn-primary"
                onClick={() => void handleCreate()}
                disabled={!handleValid || busy}
                style={{
                  padding: "12px 0",
                  fontSize: "0.62rem",
                  letterSpacing: "0.28em",
                  color: handleValid && !busy ? ACCENT : MUTED,
                  background: handleValid && !busy ? "rgba(76,201,240,0.08)" : "rgba(215,226,230,0.03)",
                  border: `1px solid ${handleValid && !busy ? "rgba(76,201,240,0.28)" : BORDER_DIM}`,
                  borderRadius: 2,
                  cursor: handleValid && !busy ? "pointer" : "not-allowed",
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  gap: 8,
                  textTransform: "uppercase",
                }}
              >
                {busy ? <><Spinner /> Connecting…</> : "Create Room"}
              </button>
            </div>
          ) : (
            <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
              <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
                <label
                  htmlFor="menu-join-code"
                  style={{ fontSize: "0.52rem", letterSpacing: "0.3em", color: MUTED, textShadow: SHADOW }}
                >
                  ROOM CODE
                </label>
                <input
                  id="menu-join-code"
                  className="menu-input code-input"
                  type="text"
                  placeholder="· · · · · ·"
                  value={joinCode}
                  maxLength={6}
                  disabled={busy}
                  autoComplete="off"
                  autoCorrect="off"
                  spellCheck={false}
                  onChange={(e) => {
                    setJoinCode(e.target.value.toUpperCase().replace(/[^A-Z0-9]/g, ""));
                    if (error) setError(null);
                  }}
                  style={{ padding: "10px 12px", borderRadius: 2 }}
                />
              </div>
              <button
                className="menu-btn menu-btn-primary"
                onClick={() => void handleJoin()}
                disabled={!handleValid || !codeValid || busy}
                style={{
                  padding: "12px 0",
                  fontSize: "0.62rem",
                  letterSpacing: "0.28em",
                  color: handleValid && codeValid && !busy ? ACCENT : MUTED,
                  background: handleValid && codeValid && !busy ? "rgba(76,201,240,0.08)" : "rgba(215,226,230,0.03)",
                  border: `1px solid ${handleValid && codeValid && !busy ? "rgba(76,201,240,0.28)" : BORDER_DIM}`,
                  borderRadius: 2,
                  cursor: handleValid && codeValid && !busy ? "pointer" : "not-allowed",
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  gap: 8,
                  textTransform: "uppercase",
                }}
              >
                {busy ? <><Spinner /> Connecting…</> : "Join Room"}
              </button>
            </div>
          )}

          {/* Error banner */}
          {error && (
            <ErrorBanner
              message={error.toUpperCase()}
              onDismiss={() => setError(null)}
            />
          )}
        </div>
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Screen: Lobby
// ---------------------------------------------------------------------------
function LobbyScreen() {
  const phase = useNetStore((s) => s.phase);
  const roomId = useNetStore((s) => s.roomId);
  const selfId = useNetStore((s) => s.selfId);
  const players = useNetStore((s) => s.players);
  const error = useNetStore((s) => s.error);
  const setError = useNetStore((s) => s.setError);
  const setMode = useAppStore((s) => s.setMode);

  const [copied, setCopied] = useState(false);
  const [startHover, setStartHover] = useState(false);

  const handleStart = useCallback(() => {
    startMatch();
    setMode("multiplayer");
  }, [setMode]);

  const handleLeave = useCallback(() => {
    leaveRoom();
  }, []);

  const handleCopy = useCallback(() => {
    if (!roomId) return;
    void navigator.clipboard.writeText(roomId).then(() => {
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    });
  }, [roomId]);

  return (
    <div
      style={{
        display: "flex",
        flexDirection: "column",
        alignItems: "center",
        justifyContent: "center",
        flex: 1,
        animation: "menu-fade-in 0.35s ease-out forwards",
      }}
    >
      <div
        style={{
          position: "relative",
          width: "min(420px, 90vw)",
          background: "linear-gradient(145deg, rgba(10,16,22,0.97) 0%, rgba(5,7,10,0.97) 100%)",
          border: `1px solid ${BORDER}`,
          borderRadius: 4,
          boxShadow: `0 0 0 1px rgba(5,7,10,0.5), 0 24px 60px rgba(0,0,0,0.85), 0 0 40px rgba(76,201,240,0.05)`,
          backdropFilter: "blur(12px)",
          overflow: "hidden",
        }}
      >
        <CornerBracket pos="tl" />
        <CornerBracket pos="tr" />
        <CornerBracket pos="bl" />
        <CornerBracket pos="br" />

        {/* Header */}
        <div
          style={{
            padding: "18px 22px 14px",
            borderBottom: `1px solid rgba(76,201,240,0.10)`,
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
          }}
        >
          <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
            <div
              style={{
                width: 6,
                height: 6,
                background: "#6fdc8c",
                borderRadius: "50%",
                boxShadow: "0 0 6px rgba(111,220,140,0.8)",
              }}
            />
            <span style={{ fontSize: "0.55rem", letterSpacing: "0.38em", color: "#6fdc8c", textShadow: SHADOW }}>
              LOBBY — WAITING
            </span>
          </div>
          <span style={{ fontSize: "0.5rem", letterSpacing: "0.2em", color: MUTED }}>
            {players.length} {players.length === 1 ? "OPERATOR" : "OPERATORS"}
          </span>
        </div>

        {/* Body */}
        <div style={{ padding: "20px 22px", display: "flex", flexDirection: "column", gap: 20 }}>
          {/* Room Code */}
          <div>
            <SectionLabel>Room Code</SectionLabel>
            <div
              style={{
                display: "flex",
                alignItems: "center",
                gap: 10,
                padding: "14px 16px",
                background: "rgba(76,201,240,0.04)",
                border: `1px solid rgba(76,201,240,0.15)`,
                borderRadius: 3,
              }}
            >
              <span
                style={{
                  flex: 1,
                  fontSize: "1.8rem",
                  fontWeight: 700,
                  letterSpacing: "0.45em",
                  color: ACCENT,
                  textShadow: `0 0 18px rgba(76,201,240,0.5)`,
                  fontVariantNumeric: "tabular-nums",
                  lineHeight: 1,
                }}
              >
                {roomId ?? "------"}
              </span>
              <button
                onClick={handleCopy}
                title="Copy room code"
                style={{
                  background: "none",
                  border: `1px solid ${copied ? "rgba(111,220,140,0.4)" : BORDER_DIM}`,
                  borderRadius: 2,
                  cursor: "pointer",
                  padding: "5px 10px",
                  fontSize: "0.52rem",
                  letterSpacing: "0.22em",
                  color: copied ? "#6fdc8c" : MUTED,
                  transition: "color 120ms, border-color 120ms",
                  animation: copied ? "copy-flash 0.4s ease-out" : "none",
                  flexShrink: 0,
                }}
              >
                {copied ? "COPIED" : "COPY"}
              </button>
            </div>
          </div>

          {/* Player list */}
          <div>
            <SectionLabel>Operators</SectionLabel>
            <div style={{ display: "flex", flexDirection: "column", gap: 4 }}>
              {players.length === 0 ? (
                <div style={{ fontSize: "0.6rem", letterSpacing: "0.12em", color: MUTED, padding: "10px 0", textAlign: "center" }}>
                  Waiting for players...
                </div>
              ) : (
                players.map((player) => {
                  const isSelf = player.id === selfId;
                  return (
                    <div
                      key={player.id}
                      style={{
                        display: "flex",
                        alignItems: "center",
                        padding: "8px 12px",
                        background: isSelf ? "rgba(76,201,240,0.06)" : "rgba(215,226,230,0.025)",
                        border: `1px solid ${isSelf ? "rgba(76,201,240,0.18)" : BORDER_DIM}`,
                        borderRadius: 2,
                        gap: 10,
                        animation: "menu-slide-up 0.25s ease-out both",
                      }}
                    >
                      {/* Status dot */}
                      <div
                        style={{
                          width: 5,
                          height: 5,
                          borderRadius: "50%",
                          background: isSelf ? ACCENT : "#6fdc8c",
                          boxShadow: `0 0 4px ${isSelf ? "rgba(76,201,240,0.6)" : "rgba(111,220,140,0.6)"}`,
                          flexShrink: 0,
                        }}
                      />
                      {/* Handle */}
                      <span
                        style={{
                          flex: 1,
                          fontSize: "0.7rem",
                          letterSpacing: "0.12em",
                          color: isSelf ? ACCENT : FG,
                          textShadow: isSelf ? SHADOW : undefined,
                          overflow: "hidden",
                          textOverflow: "ellipsis",
                          whiteSpace: "nowrap",
                        }}
                      >
                        {player.handle}
                      </span>
                      {/* Badges */}
                      <div style={{ display: "flex", gap: 6, alignItems: "center", flexShrink: 0 }}>
                        {isSelf && (
                          <span style={{ fontSize: "0.44rem", letterSpacing: "0.28em", color: ACCENT, background: "rgba(76,201,240,0.10)", border: `1px solid rgba(76,201,240,0.25)`, borderRadius: 1, padding: "2px 5px" }}>
                            YOU
                          </span>
                        )}
                        {player.authed && (
                          <span style={{ fontSize: "0.44rem", letterSpacing: "0.22em", color: MUTED, opacity: 0.6 }}>
                            &#x2713;
                          </span>
                        )}
                      </div>
                    </div>
                  );
                })
              )}
            </div>
          </div>

          {/* Error */}
          {error && (
            <ErrorBanner
              message={error.toUpperCase()}
              onDismiss={() => setError(null)}
            />
          )}

          {/* Action row */}
          <div style={{ display: "flex", gap: 8 }}>
            <button
              className="menu-btn menu-btn-danger"
              onClick={handleLeave}
              style={{
                flex: 1,
                padding: "10px 0",
                fontSize: "0.58rem",
                letterSpacing: "0.25em",
                color: MUTED,
                background: "rgba(215,226,230,0.03)",
                border: `1px solid ${BORDER_DIM}`,
                borderRadius: 2,
                cursor: "pointer",
                textTransform: "uppercase",
                fontFamily: "inherit",
              }}
            >
              Leave
            </button>
            <button
              className="menu-btn menu-btn-success"
              onClick={handleStart}
              onMouseEnter={() => setStartHover(true)}
              onMouseLeave={() => setStartHover(false)}
              disabled={phase !== "lobby"}
              style={{
                flex: 3,
                padding: "10px 0",
                fontSize: "0.62rem",
                letterSpacing: "0.28em",
                color: startHover ? BG : ACCENT,
                background: startHover ? ACCENT : "rgba(76,201,240,0.10)",
                border: `1px solid ${startHover ? ACCENT : "rgba(76,201,240,0.35)"}`,
                borderRadius: 2,
                cursor: phase === "lobby" ? "pointer" : "not-allowed",
                boxShadow: startHover ? "0 0 22px rgba(76,201,240,0.45)" : "none",
                transition: "color 140ms, background 140ms, border-color 140ms, box-shadow 140ms",
                textTransform: "uppercase",
                fontFamily: "inherit",
              }}
            >
              Start Match
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Background — scanline + grid atmospherics
// ---------------------------------------------------------------------------
function MenuBackground() {
  return (
    <div
      aria-hidden="true"
      style={{
        position: "absolute",
        inset: 0,
        overflow: "hidden",
        pointerEvents: "none",
        zIndex: 0,
      }}
    >
      {/* Dark base with subtle radial vignette */}
      <div
        style={{
          position: "absolute",
          inset: 0,
          background: `radial-gradient(ellipse 120% 90% at 50% 30%, rgba(8,14,22,0.6) 0%, ${BG} 70%)`,
        }}
      />
      {/* Faint grid */}
      <div
        style={{
          position: "absolute",
          inset: 0,
          backgroundImage: `
            linear-gradient(rgba(76,201,240,0.025) 1px, transparent 1px),
            linear-gradient(90deg, rgba(76,201,240,0.025) 1px, transparent 1px)
          `,
          backgroundSize: "60px 60px",
        }}
      />
      {/* Subtle cyan horizon glow */}
      <div
        style={{
          position: "absolute",
          bottom: 0,
          left: "50%",
          transform: "translateX(-50%)",
          width: "80%",
          height: "40%",
          background: "radial-gradient(ellipse 100% 60% at 50% 100%, rgba(76,201,240,0.05) 0%, transparent 70%)",
        }}
      />
      {/* Scanning line */}
      <div
        style={{
          position: "absolute",
          left: 0,
          right: 0,
          height: 1,
          background: "linear-gradient(to right, transparent, rgba(76,201,240,0.25) 30%, rgba(76,201,240,0.25) 70%, transparent)",
          animation: "scan-line 6s linear infinite",
          opacity: 0.6,
        }}
      />
    </div>
  );
}

// ---------------------------------------------------------------------------
// Root component
// ---------------------------------------------------------------------------
type MenuView = "landing" | "multiplayer-setup";

export function MainMenu() {
  const phase = useNetStore((s) => s.phase);

  // Determine which sub-view to show.
  // If we're in lobby/playing phases, the lobby screen takes over regardless
  // of what internal view is active.
  const [view, setView] = useState<MenuView>("landing");

  // Inject styles on mount
  useEffect(() => {
    ensureMenuStyles();
  }, []);

  // Determine screen to render
  const setMode = useAppStore((s) => s.setMode);

  const inLobby = phase === "lobby" || phase === "playing";

  let screen: React.ReactNode;

  if (inLobby) {
    screen = <LobbyScreen />;
  } else if (view === "multiplayer-setup") {
    screen = (
      <MultiplayerSetup
        onBack={() => setView("landing")}
      />
    );
  } else {
    screen = (
      <LandingScreen
        onSinglePlayer={() => setMode("single")}
        onMultiplayer={() => setView("multiplayer-setup")}
      />
    );
  }

  return (
    <div
      style={{
        position: "fixed",
        inset: 0,
        zIndex: 60,
        display: "flex",
        flexDirection: "column",
        background: BG,
        color: FG,
        fontFamily: "ui-monospace, 'SF Mono', 'Cascadia Code', Menlo, Consolas, monospace",
        WebkitFontSmoothing: "antialiased",
        overflow: "hidden",
      }}
    >
      <MenuBackground />

      {/* Content layer */}
      <div
        style={{
          position: "relative",
          zIndex: 1,
          display: "flex",
          flexDirection: "column",
          flex: 1,
          padding: "24px 32px",
        }}
      >
        {/* Top bar */}
        <div
          style={{
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
            marginBottom: 0,
          }}
        >
          {/* Left: mini wordmark + status */}
          <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
            <span
              style={{
                fontSize: "0.6rem",
                letterSpacing: "0.45em",
                color: "rgba(76,201,240,0.5)",
                textShadow: SHADOW,
                fontWeight: 700,
              }}
            >
              RECON
            </span>
            <div
              style={{
                width: 1,
                height: 12,
                background: BORDER_DIM,
              }}
            />
            <span
              style={{
                fontSize: "0.48rem",
                letterSpacing: "0.25em",
                color: "rgba(215,226,230,0.2)",
              }}
            >
              TACTICAL OPERATIONS
            </span>
          </div>

          {/* Right: connection phase indicator */}
          {phase !== "idle" && (
            <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
              <div
                style={{
                  width: 5,
                  height: 5,
                  borderRadius: "50%",
                  background: phase === "connecting" ? WARN : "#6fdc8c",
                  boxShadow: `0 0 5px ${phase === "connecting" ? "rgba(240,160,76,0.8)" : "rgba(111,220,140,0.8)"}`,
                }}
              />
              <span style={{ fontSize: "0.48rem", letterSpacing: "0.25em", color: MUTED }}>
                {phase === "connecting" ? "CONNECTING" : phase === "lobby" ? "LOBBY" : "IN MATCH"}
              </span>
            </div>
          )}
        </div>

        {/* Main content area */}
        {screen}
      </div>
    </div>
  );
}
