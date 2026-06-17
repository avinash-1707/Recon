"use client";

import { useEffect, useRef } from "react";
import { useAppStore } from "@/game/state/appStore";
import { useNetStore } from "@/game/state/netStore";
import { playerRuntime } from "@/game/state/runtime";
import { PLOTS } from "@/game/levels/layout";
import { peerViews } from "@/game/net/remotePeers";

// ─── Design constants (match Hud / Scoreboard palette) ────────────────────────
const BG           = "rgba(5,7,10,0.82)";
const BORDER       = "rgba(76,201,240,0.28)";
const GRID_COLOR   = "rgba(76,201,240,0.07)";
const HOUSE_FILL   = "rgba(215,226,230,0.18)";
const HOUSE_STROKE = "rgba(215,226,230,0.30)";
const WARE_FILL    = "rgba(76,201,240,0.12)";
const WARE_STROKE  = "rgba(76,201,240,0.32)";
const PLAYER_COLOR = "#4cc9f0";
const PEER_COLOR   = "#f04c4c";   // red blips for hostiles
const LABEL_COLOR  = "rgba(215,226,230,0.45)";
const CARDINAL_COLOR = "rgba(76,201,240,0.50)";

/** Half the world radius used to map world-units → canvas pixels (perimeter ≈ 80). */
const WORLD_HALF = 80;

/** Building footprint half-sizes (metres) — match true footprints. */
const HOUSE_HALF  = 4.7;
const WARE_HALF   = 5.0;

// ─── Coordinate helpers ────────────────────────────────────────────────────────

function worldToScreen(
  wx: number,
  wz: number,
  cx: number,
  cy: number,
  R: number,
): [number, number] {
  return [
    cx + (wx / WORLD_HALF) * R,
    cy + (wz / WORLD_HALF) * R,
  ];
}

// ─── Canvas draw routine (runs every rAF, zero React involvement) ─────────────

function draw(
  ctx: CanvasRenderingContext2D,
  dpr: number,
  cssSize: number,
  isMultiplayer: boolean,
): void {
  const W = cssSize * dpr;
  ctx.clearRect(0, 0, W, W);

  const cx = W / 2;
  const cy = W / 2;
  const R  = W / 2 - 2 * dpr; // leave 2px gap from edge for the border

  // ── Clip to circle ───────────────────────────────────────────────────────
  ctx.save();
  ctx.beginPath();
  ctx.arc(cx, cy, R, 0, Math.PI * 2);
  ctx.clip();

  // ── Panel background ─────────────────────────────────────────────────────
  ctx.fillStyle = "rgba(5,7,10,0.84)";
  ctx.fillRect(0, 0, W, W);

  // ── Faint grid (N-S and E-W avenues at world x=0 / z=0) ─────────────────
  ctx.save();
  ctx.strokeStyle = GRID_COLOR;
  ctx.lineWidth = dpr;
  // Vertical line (world x=0, N-S avenue)
  ctx.beginPath();
  ctx.moveTo(cx, 0);
  ctx.lineTo(cx, W);
  ctx.stroke();
  // Horizontal line (world z=0, E-W avenue)
  ctx.beginPath();
  ctx.moveTo(0, cy);
  ctx.lineTo(W, cy);
  ctx.stroke();
  ctx.restore();

  // ── Buildings ─────────────────────────────────────────────────────────────
  for (const plot of PLOTS) {
    // Bigger archetypes (warehouse/squad/tower) read larger + cyan-tinted.
    const big = plot.kind >= 2;
    const half =
      plot.kind === 3 ? 7 : plot.kind === 4 ? 4.5 : plot.kind === 2 ? WARE_HALF : HOUSE_HALF;
    const [sx, sy] = worldToScreen(plot.x, plot.z, cx, cy, R);

    // Skip if clearly outside the circle (quick reject)
    if (Math.hypot(sx - cx, sy - cy) > R + half * (R / WORLD_HALF) * 1.5) continue;

    const pxHalf = (half / WORLD_HALF) * R;

    ctx.save();
    ctx.translate(sx, sy);
    ctx.rotate(plot.yaw);
    ctx.fillStyle   = big ? WARE_FILL   : HOUSE_FILL;
    ctx.strokeStyle = big ? WARE_STROKE : HOUSE_STROKE;
    ctx.lineWidth   = dpr * 0.75;
    ctx.fillRect(-pxHalf, -pxHalf, pxHalf * 2, pxHalf * 2);
    ctx.strokeRect(-pxHalf, -pxHalf, pxHalf * 2, pxHalf * 2);
    ctx.restore();
  }

  // ── Remote player blips (multiplayer only) ────────────────────────────────
  if (isMultiplayer) {
    ctx.fillStyle = PEER_COLOR;
    for (const view of peerViews.values()) {
      const [sx, sy] = worldToScreen(view.renderPos.x, view.renderPos.z, cx, cy, R);
      const dist = Math.hypot(sx - cx, sy - cy);
      if (dist > R) continue;
      ctx.beginPath();
      ctx.arc(sx, sy, 2.5 * dpr, 0, Math.PI * 2);
      ctx.fill();
    }
  }

  // ── Local player heading triangle ─────────────────────────────────────────
  const px = playerRuntime.position.x;
  const pz = playerRuntime.position.z;
  const [spx, spy] = worldToScreen(px, pz, cx, cy, R);

  const yaw = playerRuntime.yaw;
  // yaw 0 faces -Z; forward in world (x,z) = (-sin(yaw), -cos(yaw))
  // On screen: screenX ∝ worldX, screenY ∝ worldZ, so:
  //   forwardScreen = (-sin(yaw), -cos(yaw))  — already correct
  const fwdX = -Math.sin(yaw);
  const fwdY = -Math.cos(yaw); // note: canvas Y is +down, worldZ +down, so sign matches

  const triLen  = 7 * dpr;
  const triWide = 4 * dpr;

  // Perpendicular to forward
  const perpX = -fwdY;
  const perpY =  fwdX;

  ctx.save();
  ctx.fillStyle   = PLAYER_COLOR;
  ctx.strokeStyle = "rgba(0,0,0,0.6)";
  ctx.lineWidth   = dpr * 0.5;
  ctx.shadowColor  = PLAYER_COLOR;
  ctx.shadowBlur   = 4 * dpr;
  ctx.beginPath();
  ctx.moveTo(spx + fwdX * triLen,  spy + fwdY * triLen);
  ctx.lineTo(spx + perpX * triWide, spy + perpY * triWide);
  ctx.lineTo(spx - perpX * triWide, spy - perpY * triWide);
  ctx.closePath();
  ctx.fill();
  ctx.stroke();
  ctx.restore();

  ctx.restore(); // end clip

  // ── Circular border ───────────────────────────────────────────────────────
  ctx.beginPath();
  ctx.arc(cx, cy, R, 0, Math.PI * 2);
  ctx.strokeStyle = BORDER;
  ctx.lineWidth   = dpr;
  ctx.stroke();

  // ── Cardinal "N" label (top-center, inside circle) ───────────────────────
  ctx.save();
  ctx.fillStyle = CARDINAL_COLOR;
  ctx.font      = `${Math.round(7 * dpr)}px ui-monospace, monospace`;
  ctx.textAlign = "center";
  ctx.textBaseline = "top";
  ctx.fillText("N", cx, 5 * dpr);
  ctx.restore();
}

// ─── Component ────────────────────────────────────────────────────────────────

export function Minimap() {
  const canvasRef  = useRef<HTMLCanvasElement>(null);
  const rafRef     = useRef<number>(0);
  const sizeRef    = useRef<number>(160); // tracks current CSS px size

  // These change rarely — subscribing via React is fine per spec.
  const mode   = useAppStore((s) => s.mode);
  const selfId = useNetStore((s) => s.selfId);
  const isMultiplayer = mode === "multiplayer";

  // Keep selfId accessible inside the rAF closure without restarting the loop.
  const multiRef = useRef(isMultiplayer);
  useEffect(() => { multiRef.current = isMultiplayer; }, [isMultiplayer]);

  // Suppress unused-variable warning: selfId is read by the caller but we only
  // need it to confirm we're in a valid multiplayer session (mode check is enough).
  void selfId;

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    // ── Backing-store resize ─────────────────────────────────────────────────
    function syncSize() {
      if (!canvas) return;
      const cssSize = canvas.getBoundingClientRect().width || sizeRef.current;
      sizeRef.current = cssSize;
      const dpr = window.devicePixelRatio || 1;
      canvas.width  = Math.round(cssSize * dpr);
      canvas.height = Math.round(cssSize * dpr);
    }

    syncSize();

    const ro = new ResizeObserver(syncSize);
    ro.observe(canvas);

    // ── rAF loop ─────────────────────────────────────────────────────────────
    function loop() {
      if (!canvas || !ctx) return;
      const dpr     = window.devicePixelRatio || 1;
      const cssSize = sizeRef.current;
      draw(ctx, dpr, cssSize, multiRef.current);
      rafRef.current = requestAnimationFrame(loop);
    }

    rafRef.current = requestAnimationFrame(loop);

    return () => {
      cancelAnimationFrame(rafRef.current);
      ro.disconnect();
    };
  }, []); // mount/unmount only — loop reads mutable singletons directly

  return (
    <div
      style={{
        position:      "fixed",
        top:           16,
        left:          16,
        zIndex:        30,
        pointerEvents: "none",
        // Responsive square: fluid between 120 px and 200 px
        width:  "clamp(120px, 16vw, 200px)",
        height: "clamp(120px, 16vw, 200px)",
      }}
    >
      {/* Outer panel — square container with a subtle dark background for the label strip */}
      <div
        style={{
          position:     "relative",
          width:        "100%",
          height:       "100%",
          background:   BG,
          border:       `1px solid ${BORDER}`,
          borderRadius: 2,
          overflow:     "hidden",
          boxShadow:    "0 2px 12px rgba(0,0,0,0.7), inset 0 0 0 1px rgba(76,201,240,0.06)",
        }}
      >
        {/* Canvas fills the panel */}
        <canvas
          ref={canvasRef}
          style={{
            display:  "block",
            width:    "100%",
            height:   "100%",
            // Circular mask matches the drawn circle
            borderRadius: "50%",
          }}
        />

        {/* Micro-label strip across the bottom */}
        <div
          style={{
            position:    "absolute",
            bottom:      0,
            left:        0,
            right:       0,
            textAlign:   "center",
            paddingBottom: 3,
            fontSize:    "0.45rem",
            letterSpacing: "0.25em",
            color:       LABEL_COLOR,
            fontFamily:  "ui-monospace, monospace",
            textShadow:  "0 1px 3px rgba(0,0,0,0.9)",
            userSelect:  "none",
          }}
        >
          SECTOR
        </div>
      </div>
    </div>
  );
}
