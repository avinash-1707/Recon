"use client";

import { useState, useCallback } from "react";
import { useSettingsStore, SENS_MIN, SENS_MAX } from "@/game/state/settingsStore";
import { useWorldStore } from "@/game/state/worldStore";
import { useIsTouch } from "@/hooks/useIsTouch";

// ---------------------------------------------------------------------------
// Design tokens - mirror the project's HUD palette exactly.
// ---------------------------------------------------------------------------
const ACCENT   = "#4cc9f0";
const FG       = "#d7e2e6";
const WARN     = "#f0a04c";
const BG_DARK  = "#05070a";
const SHADOW   = "0 1px 3px rgba(0,0,0,0.9)";
const MUTED    = "rgba(215,226,230,0.45)";

// ---------------------------------------------------------------------------
// Gear SVG icon - clean 22px cog, no third-party dep.
// ---------------------------------------------------------------------------
function GearIcon({ size = 22, color = FG }: { size?: number; color?: string }) {
  // 8-tooth cog drawn entirely with path data, centered at (12,12) in a 24x24 viewBox.
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      aria-hidden="true"
      style={{ display: "block" }}
    >
      <path
        fill={color}
        d={[
          // Outer gear teeth (8-tooth)
          "M12 2a1 1 0 0 1 1 1v1.07a7.02 7.02 0 0 1 2.47 1.02l.76-.76a1 1 0 0 1 1.41 1.41l-.76.76",
          "A7.02 7.02 0 0 1 17.93 9H19a1 1 0 1 1 0 2h-1.07a7.02 7.02 0 0 1-1.02 2.47l.76.76",
          "a1 1 0 0 1-1.41 1.41l-.76-.76A7.02 7.02 0 0 1 13 15.93V17a1 1 0 1 1-2 0v-1.07",
          "a7.02 7.02 0 0 1-2.47-1.02l-.76.76a1 1 0 0 1-1.41-1.41l.76-.76A7.02 7.02 0 0 1 6.07 11H5",
          "a1 1 0 1 1 0-2h1.07A7.02 7.02 0 0 1 7.1 6.53l-.76-.76a1 1 0 0 1 1.41-1.41l.76.76",
          "A7.02 7.02 0 0 1 11 4.07V3a1 1 0 0 1 1-1z",
          // Inner circle cutout
          "M12 9a3 3 0 1 0 0 6 3 3 0 0 0 0-6z",
        ].join(" ")}
        fillRule="evenodd"
        clipRule="evenodd"
      />
    </svg>
  );
}

// ---------------------------------------------------------------------------
// Styled range slider (pure inline - no CSS class).
// We inject a <style> tag once so we can style the thumb/track pseudo-elements
// that are unreachable from inline styles.
// ---------------------------------------------------------------------------
let sliderStyleInjected = false;
function ensureSliderStyle() {
  if (typeof document === "undefined" || sliderStyleInjected) return;
  sliderStyleInjected = true;
  const style = document.createElement("style");
  style.textContent = `
    .recon-slider {
      -webkit-appearance: none;
      appearance: none;
      height: 3px;
      border-radius: 2px;
      background: rgba(76,201,240,0.18);
      outline: none;
      cursor: pointer;
      width: 100%;
    }
    .recon-slider::-webkit-slider-thumb {
      -webkit-appearance: none;
      appearance: none;
      width: 14px;
      height: 14px;
      border-radius: 50%;
      background: #4cc9f0;
      box-shadow: 0 0 6px rgba(76,201,240,0.7);
      cursor: grab;
      transition: box-shadow 120ms, transform 120ms;
    }
    .recon-slider::-webkit-slider-thumb:active {
      cursor: grabbing;
      transform: scale(1.18);
      box-shadow: 0 0 10px rgba(76,201,240,0.9);
    }
    .recon-slider::-moz-range-thumb {
      width: 14px;
      height: 14px;
      border-radius: 50%;
      background: #4cc9f0;
      box-shadow: 0 0 6px rgba(76,201,240,0.7);
      border: none;
      cursor: grab;
    }
    .recon-slider::-webkit-slider-runnable-track {
      background: linear-gradient(
        to right,
        rgba(76,201,240,0.5) var(--track-pct, 50%),
        rgba(76,201,240,0.12) var(--track-pct, 50%)
      );
      height: 3px;
      border-radius: 2px;
    }
    .recon-slider::-moz-range-track {
      background: rgba(76,201,240,0.15);
      height: 3px;
      border-radius: 2px;
    }
    .recon-slider::-moz-range-progress {
      background: rgba(76,201,240,0.5);
      height: 3px;
      border-radius: 2px;
    }
    @keyframes recon-panel-in {
      from { opacity: 0; transform: translate(-50%, -50%) scale(0.96); }
      to   { opacity: 1; transform: translate(-50%, -50%) scale(1); }
    }
    @keyframes recon-backdrop-in {
      from { opacity: 0; }
      to   { opacity: 1; }
    }
  `;
  document.head.appendChild(style);
}

// ---------------------------------------------------------------------------
// Sensitivity slider with live-fill track.
// ---------------------------------------------------------------------------
function SensSlider({
  label,
  value,
  onChange,
}: {
  label: string;
  value: number;
  onChange: (v: number) => void;
}) {
  ensureSliderStyle();

  const pct = ((value - SENS_MIN) / (SENS_MAX - SENS_MIN)) * 100;

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
      {/* Row: label + value */}
      <div
        style={{
          display: "flex",
          alignItems: "baseline",
          justifyContent: "space-between",
        }}
      >
        <span
          style={{
            fontSize: "0.58rem",
            letterSpacing: "0.25em",
            color: MUTED,
            textShadow: SHADOW,
          }}
        >
          {label}
        </span>
        <span
          style={{
            fontSize: "0.88rem",
            fontVariantNumeric: "tabular-nums",
            color: ACCENT,
            textShadow: SHADOW,
            minWidth: "3ch",
            textAlign: "right",
          }}
        >
          {value.toFixed(2)}&times;
        </span>
      </div>

      {/* Slider */}
      <input
        type="range"
        className="recon-slider"
        min={SENS_MIN}
        max={SENS_MAX}
        step={0.05}
        value={value}
        onChange={(e) => onChange(parseFloat(e.target.value))}
        // Live-fill the track via CSS custom property
        style={
          {
            "--track-pct": `${pct.toFixed(1)}%`,
            touchAction: "none",
          } as React.CSSProperties
        }
      />

      {/* Min/max labels */}
      <div
        style={{
          display: "flex",
          justifyContent: "space-between",
          fontSize: "0.5rem",
          letterSpacing: "0.15em",
          color: "rgba(215,226,230,0.25)",
          marginTop: -4,
        }}
      >
        <span>{SENS_MIN.toFixed(2)}</span>
        <span>{SENS_MAX.toFixed(2)}</span>
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Toggle switch (Invert Y).
// ---------------------------------------------------------------------------
function ToggleSwitch({
  label,
  checked,
  onChange,
}: {
  label: string;
  checked: boolean;
  onChange: (v: boolean) => void;
}) {
  return (
    <div
      style={{
        display: "flex",
        alignItems: "center",
        justifyContent: "space-between",
        cursor: "pointer",
        userSelect: "none",
      }}
      onClick={() => onChange(!checked)}
      role="switch"
      aria-checked={checked}
      tabIndex={0}
      onKeyDown={(e) => {
        if (e.key === " " || e.key === "Enter") {
          e.preventDefault();
          onChange(!checked);
        }
      }}
    >
      <span
        style={{
          fontSize: "0.58rem",
          letterSpacing: "0.25em",
          color: MUTED,
          textShadow: SHADOW,
        }}
      >
        {label}
      </span>

      {/* Track */}
      <div
        style={{
          position: "relative",
          width: 36,
          height: 18,
          borderRadius: 9,
          background: checked
            ? `rgba(76,201,240,0.3)`
            : "rgba(215,226,230,0.08)",
          border: checked
            ? `1px solid rgba(76,201,240,0.6)`
            : "1px solid rgba(215,226,230,0.18)",
          transition: "background 160ms, border-color 160ms",
          flexShrink: 0,
        }}
      >
        {/* Thumb */}
        <div
          style={{
            position: "absolute",
            top: 2,
            left: checked ? 18 : 2,
            width: 12,
            height: 12,
            borderRadius: "50%",
            background: checked ? ACCENT : "rgba(215,226,230,0.4)",
            boxShadow: checked ? `0 0 5px rgba(76,201,240,0.7)` : "none",
            transition: "left 160ms cubic-bezier(0.4,0,0.2,1), background 160ms, box-shadow 160ms",
          }}
        />
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Divider.
// ---------------------------------------------------------------------------
function Divider() {
  return (
    <div
      style={{
        height: 1,
        background:
          "linear-gradient(to right, transparent, rgba(76,201,240,0.15) 30%, rgba(76,201,240,0.15) 70%, transparent)",
        margin: "2px 0",
      }}
    />
  );
}

// ---------------------------------------------------------------------------
// Main component.
// ---------------------------------------------------------------------------
export function SettingsMenu() {
  const [open, setOpen] = useState(false);

  const isTouch = useIsTouch();

  // Settings store selectors (stable references via Zustand's slice pattern).
  const mouseSensitivity    = useSettingsStore((s) => s.mouseSensitivity);
  const touchSensitivity    = useSettingsStore((s) => s.touchSensitivity);
  const invertY             = useSettingsStore((s) => s.invertY);
  const setMouseSensitivity = useSettingsStore((s) => s.setMouseSensitivity);
  const setTouchSensitivity = useSettingsStore((s) => s.setTouchSensitivity);
  const setInvertY          = useSettingsStore((s) => s.setInvertY);
  const reset               = useSettingsStore((s) => s.reset);

  // ------------------------------------------------------------------
  // Open: pause sim + release pointer lock.
  // ------------------------------------------------------------------
  const openPanel = useCallback(() => {
    useWorldStore.getState().setPaused(true);
    if (document.pointerLockElement) document.exitPointerLock();
    setOpen(true);
  }, []);

  // ------------------------------------------------------------------
  // Close: un-pause sim + re-engage pointer lock (desktop only).
  // ------------------------------------------------------------------
  const closePanel = useCallback(() => {
    useWorldStore.getState().setPaused(false);
    if (!isTouch) {
      // Re-lock is a user-gesture; if it fails (e.g. on a secondary monitor
      // click) the PlayOverlay will re-appear and re-lock on the next click.
      document
        .querySelector<HTMLCanvasElement>("#game-root canvas")
        ?.requestPointerLock();
    }
    setOpen(false);
  }, [isTouch]);

  // Gear button hover state handled via React state to stay inline-only.
  const [gearHover, setGearHover] = useState(false);
  const [resetHover, setResetHover] = useState(false);
  const [doneHover, setDoneHover] = useState(false);

  return (
    <>
      {/* ----------------------------------------------------------------
          Gear button — fixed top-left, always visible above HUD.
          ---------------------------------------------------------------- */}
      <button
        onClick={openPanel}
        onMouseEnter={() => setGearHover(true)}
        onMouseLeave={() => setGearHover(false)}
        aria-label="Settings"
        style={{
          position: "fixed",
          top: 12,
          left: 12,
          zIndex: 70,
          width: 34,
          height: 34,
          borderRadius: "50%",
          border: "1px solid rgba(215,226,230,0.14)",
          background: gearHover
            ? "rgba(76,201,240,0.12)"
            : "rgba(5,7,10,0.55)",
          backdropFilter: "blur(6px)",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          cursor: "pointer",
          padding: 0,
          opacity: gearHover ? 0.95 : 0.55,
          transition: "opacity 140ms, background 140ms, border-color 140ms",
          // Raise border luminance on hover.
          borderColor: gearHover
            ? "rgba(76,201,240,0.35)"
            : "rgba(215,226,230,0.14)",
          pointerEvents: "auto",
        }}
      >
        <GearIcon size={18} color={gearHover ? ACCENT : FG} />
      </button>

      {/* ----------------------------------------------------------------
          Panel + backdrop — only mounted when open.
          ---------------------------------------------------------------- */}
      {open && (
        <>
          {/* Dim backdrop */}
          <div
            onClick={closePanel}
            style={{
              position: "fixed",
              inset: 0,
              zIndex: 72,
              background: "rgba(5,7,10,0.70)",
              backdropFilter: "blur(3px)",
              animation: "recon-backdrop-in 150ms ease-out forwards",
              pointerEvents: "auto",
            }}
          />

          {/* Settings card */}
          <div
            // Prevent backdrop-click from propagating through the card.
            onClick={(e) => e.stopPropagation()}
            style={{
              position: "fixed",
              top: "50%",
              left: "50%",
              transform: "translate(-50%, -50%)",
              zIndex: 73,
              width: 340,
              maxWidth: "90vw",
              background:
                "linear-gradient(145deg, rgba(10,16,22,0.97) 0%, rgba(5,7,10,0.97) 100%)",
              border: "1px solid rgba(76,201,240,0.18)",
              boxShadow:
                "0 0 0 1px rgba(5,7,10,0.5), 0 24px 60px rgba(0,0,0,0.85), 0 0 30px rgba(76,201,240,0.06)",
              backdropFilter: "blur(12px)",
              borderRadius: 6,
              display: "flex",
              flexDirection: "column",
              gap: 0,
              animation: "recon-panel-in 180ms cubic-bezier(0.22,1,0.36,1) forwards",
              pointerEvents: "auto",
              overflow: "hidden",
            }}
          >
            {/* ---- Title bar ---- */}
            <div
              style={{
                display: "flex",
                alignItems: "center",
                justifyContent: "space-between",
                padding: "16px 20px 14px",
                borderBottom: "1px solid rgba(76,201,240,0.10)",
              }}
            >
              <div
                style={{
                  display: "flex",
                  alignItems: "center",
                  gap: 8,
                }}
              >
                <GearIcon size={13} color={ACCENT} />
                <span
                  style={{
                    fontSize: "0.58rem",
                    letterSpacing: "0.35em",
                    color: ACCENT,
                    textShadow: SHADOW,
                  }}
                >
                  SETTINGS
                </span>
              </div>
              {/* X close */}
              <button
                onClick={closePanel}
                aria-label="Close settings"
                style={{
                  background: "none",
                  border: "none",
                  cursor: "pointer",
                  padding: "2px 4px",
                  color: MUTED,
                  fontSize: "0.9rem",
                  lineHeight: 1,
                  opacity: 0.6,
                  transition: "opacity 100ms",
                }}
                onMouseEnter={(e) =>
                  ((e.currentTarget as HTMLButtonElement).style.opacity = "1")
                }
                onMouseLeave={(e) =>
                  ((e.currentTarget as HTMLButtonElement).style.opacity = "0.6")
                }
              >
                &#x2715;
              </button>
            </div>

            {/* ---- Body ---- */}
            <div
              style={{
                display: "flex",
                flexDirection: "column",
                gap: 18,
                padding: "20px 20px 16px",
              }}
            >
              {/* Sensitivity slider — device-gated */}
              {isTouch ? (
                <SensSlider
                  label="LOOK SENSITIVITY"
                  value={touchSensitivity}
                  onChange={setTouchSensitivity}
                />
              ) : (
                <SensSlider
                  label="MOUSE SENSITIVITY"
                  value={mouseSensitivity}
                  onChange={setMouseSensitivity}
                />
              )}

              <Divider />

              {/* Invert Y toggle */}
              <ToggleSwitch
                label="INVERT Y AXIS"
                checked={invertY}
                onChange={setInvertY}
              />
            </div>

            {/* ---- Footer actions ---- */}
            <div
              style={{
                display: "flex",
                gap: 8,
                padding: "12px 20px 18px",
                borderTop: "1px solid rgba(76,201,240,0.08)",
              }}
            >
              {/* Reset */}
              <button
                onClick={reset}
                onMouseEnter={() => setResetHover(true)}
                onMouseLeave={() => setResetHover(false)}
                style={{
                  flex: 1,
                  padding: "8px 0",
                  fontSize: "0.58rem",
                  letterSpacing: "0.22em",
                  color: resetHover ? WARN : MUTED,
                  background: resetHover
                    ? "rgba(240,160,76,0.07)"
                    : "rgba(215,226,230,0.04)",
                  border: `1px solid ${
                    resetHover
                      ? "rgba(240,160,76,0.35)"
                      : "rgba(215,226,230,0.12)"
                  }`,
                  borderRadius: 3,
                  cursor: "pointer",
                  transition: "color 140ms, background 140ms, border-color 140ms",
                }}
              >
                RESET
              </button>

              {/* Done / Resume */}
              <button
                onClick={closePanel}
                onMouseEnter={() => setDoneHover(true)}
                onMouseLeave={() => setDoneHover(false)}
                style={{
                  flex: 2,
                  padding: "8px 0",
                  fontSize: "0.58rem",
                  letterSpacing: "0.22em",
                  color: doneHover ? BG_DARK : ACCENT,
                  background: doneHover
                    ? ACCENT
                    : "rgba(76,201,240,0.08)",
                  border: `1px solid ${
                    doneHover
                      ? ACCENT
                      : "rgba(76,201,240,0.35)"
                  }`,
                  borderRadius: 3,
                  cursor: "pointer",
                  boxShadow: doneHover
                    ? "0 0 14px rgba(76,201,240,0.45)"
                    : "none",
                  transition:
                    "color 140ms, background 140ms, border-color 140ms, box-shadow 140ms",
                  fontWeight: doneHover ? 600 : 400,
                }}
              >
                RESUME
              </button>
            </div>
          </div>
        </>
      )}
    </>
  );
}
