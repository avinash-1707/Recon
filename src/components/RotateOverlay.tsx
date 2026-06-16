"use client";

import { useEffect, useState } from "react";

const ACCENT = "#4cc9f0";
const SHADOW = "0 1px 3px rgba(0,0,0,0.9)";

// ---------------------------------------------------------------------------
// Orientation detection
// ---------------------------------------------------------------------------
function useIsPortrait(): boolean {
  const [portrait, setPortrait] = useState<boolean>(() => {
    if (typeof window === "undefined") return false;
    return window.matchMedia("(orientation: portrait)").matches;
  });

  useEffect(() => {
    const mq = window.matchMedia("(orientation: portrait)");
    const handler = (e: MediaQueryListEvent) => setPortrait(e.matches);
    mq.addEventListener("change", handler);
    return () => mq.removeEventListener("change", handler);
  }, []);

  return portrait;
}

// ---------------------------------------------------------------------------
// Phone SVG glyph (outline, CSS-animated)
// ---------------------------------------------------------------------------
function PhoneIcon() {
  return (
    <svg
      width="56"
      height="56"
      viewBox="0 0 56 56"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      aria-hidden="true"
    >
      {/* Phone body - portrait orientation (we animate it to landscape) */}
      <rect
        x="15"
        y="6"
        width="26"
        height="44"
        rx="4"
        stroke={ACCENT}
        strokeWidth="1.5"
        fill="none"
        opacity="0.9"
      />
      {/* Home button / notch hint */}
      <circle cx="28" cy="44" r="2.5" stroke={ACCENT} strokeWidth="1.2" fill="none" opacity="0.6" />
      {/* Speaker slot */}
      <rect x="23" y="10" width="10" height="1.5" rx="0.75" fill={ACCENT} opacity="0.5" />
      {/* Screen */}
      <rect x="18" y="14" width="20" height="27" rx="1.5" fill={ACCENT} opacity="0.07" />
      {/* Rotation arrow - clockwise arc around phone */}
      <path
        d="M 46 20 A 20 20 0 0 1 36 48"
        stroke={ACCENT}
        strokeWidth="1.5"
        strokeLinecap="round"
        fill="none"
        opacity="0.7"
      />
      <polyline
        points="33,46 36,49.5 39.5,46.5"
        stroke={ACCENT}
        strokeWidth="1.5"
        strokeLinecap="round"
        strokeLinejoin="round"
        fill="none"
        opacity="0.7"
      />
    </svg>
  );
}

// ---------------------------------------------------------------------------
// RotateOverlay
// ---------------------------------------------------------------------------
export function RotateOverlay() {
  const isPortrait = useIsPortrait();

  if (!isPortrait) return null;

  return (
    <>
      {/* Inject keyframes inline so no CSS module is needed */}
      <style>{`
        @keyframes rotate-phone {
          0%   { transform: rotate(0deg);   opacity: 0.7; }
          40%  { transform: rotate(-90deg); opacity: 1;   }
          65%  { transform: rotate(-90deg); opacity: 1;   }
          100% { transform: rotate(0deg);   opacity: 0.7; }
        }
        @keyframes rotate-fade-in {
          from { opacity: 0; transform: translateY(6px); }
          to   { opacity: 1; transform: translateY(0);   }
        }
        @keyframes rotate-pulse-border {
          0%, 100% { opacity: 0.25; }
          50%       { opacity: 0.55; }
        }
      `}</style>

      <div
        style={{
          position: "fixed",
          inset: 0,
          zIndex: 90,
          pointerEvents: "auto",
          touchAction: "none",
          background:
            "radial-gradient(ellipse 90% 70% at 50% 40%, #07101a 0%, #05070a 100%)",
          display: "flex",
          flexDirection: "column",
          alignItems: "center",
          justifyContent: "center",
          gap: "2rem",
          userSelect: "none",
          WebkitUserSelect: "none",
        }}
      >
        {/* Subtle corner accent lines */}
        <div
          style={{
            position: "absolute",
            inset: 0,
            pointerEvents: "none",
            overflow: "hidden",
          }}
        >
          {/* Top-left bracket */}
          <div
            style={{
              position: "absolute",
              top: 24,
              left: 24,
              width: 32,
              height: 32,
              borderTop: `1px solid rgba(76,201,240,0.3)`,
              borderLeft: `1px solid rgba(76,201,240,0.3)`,
            }}
          />
          {/* Top-right bracket */}
          <div
            style={{
              position: "absolute",
              top: 24,
              right: 24,
              width: 32,
              height: 32,
              borderTop: `1px solid rgba(76,201,240,0.3)`,
              borderRight: `1px solid rgba(76,201,240,0.3)`,
            }}
          />
          {/* Bottom-left bracket */}
          <div
            style={{
              position: "absolute",
              bottom: 24,
              left: 24,
              width: 32,
              height: 32,
              borderBottom: `1px solid rgba(76,201,240,0.3)`,
              borderLeft: `1px solid rgba(76,201,240,0.3)`,
            }}
          />
          {/* Bottom-right bracket */}
          <div
            style={{
              position: "absolute",
              bottom: 24,
              right: 24,
              width: 32,
              height: 32,
              borderBottom: `1px solid rgba(76,201,240,0.3)`,
              borderRight: `1px solid rgba(76,201,240,0.3)`,
            }}
          />
          {/* Animated border pulse */}
          <div
            style={{
              position: "absolute",
              inset: 0,
              border: "1px solid rgba(76,201,240,0.18)",
              animation: "rotate-pulse-border 2.4s ease-in-out infinite",
            }}
          />
        </div>

        {/* Animated phone glyph */}
        <div
          style={{
            animation: "rotate-phone 2.6s ease-in-out infinite",
            transformOrigin: "center center",
            filter: `drop-shadow(0 0 16px rgba(76,201,240,0.45))`,
          }}
        >
          <PhoneIcon />
        </div>

        {/* Text content */}
        <div
          style={{
            display: "flex",
            flexDirection: "column",
            alignItems: "center",
            gap: "0.55rem",
            animation: "rotate-fade-in 0.5s ease-out both",
          }}
        >
          <span
            style={{
              fontSize: "0.75rem",
              letterSpacing: "0.45em",
              color: ACCENT,
              textShadow: `${SHADOW}, 0 0 20px rgba(76,201,240,0.4)`,
              fontWeight: 600,
            }}
          >
            ROTATE YOUR DEVICE
          </span>
          <span
            style={{
              fontSize: "0.6rem",
              letterSpacing: "0.2em",
              color: "rgba(215,226,230,0.45)",
              textShadow: SHADOW,
            }}
          >
            LANDSCAPE MODE REQUIRED
          </span>
        </div>

        {/* Decorative scan line */}
        <div
          style={{
            position: "absolute",
            bottom: 48,
            display: "flex",
            alignItems: "center",
            gap: 10,
          }}
        >
          <div style={{ width: 24, height: 1, background: "rgba(76,201,240,0.2)" }} />
          <span
            style={{
              fontSize: "0.42rem",
              letterSpacing: "0.35em",
              color: "rgba(76,201,240,0.3)",
              textShadow: SHADOW,
            }}
          >
            RECON
          </span>
          <div style={{ width: 24, height: 1, background: "rgba(76,201,240,0.2)" }} />
        </div>
      </div>
    </>
  );
}
