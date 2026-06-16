"use client";

import { useRef, useState, useCallback, useEffect } from "react";
import { touch } from "@/game/systems/input";
import { useWorldStore } from "@/game/state/worldStore";
import { usePlayerStore } from "@/game/state/playerStore";
import { useWeaponStore } from "@/game/state/weaponStore";
import { WeaponType, WEAPON_SLOTS } from "@/game/weapons/types";

// ---------------------------------------------------------------------------
// Design constants - match the existing HUD aesthetic exactly
// ---------------------------------------------------------------------------
const ACCENT = "#4cc9f0";
const FG = "#d7e2e6";
const WARN = "#f0a04c";
const SHADOW = "0 1px 3px rgba(0,0,0,0.9)";

const STICK_ZONE_W = "42%"; // left 42% of screen is joystick zone
const STICK_RADIUS = 55; // px, clamping radius for knob travel
const SPRINT_THRESHOLD = 0.7; // nz above this = sprint

const BTN_SIZE = 58; // action button diameter px
const BTN_FIRE_SIZE = 70; // FIRE is slightly larger

// ---------------------------------------------------------------------------
// Weapon slot metadata
// ---------------------------------------------------------------------------
interface SlotMeta {
  slot: number;
  label: string;
  abbr: string;
  type: WeaponType;
}

const SLOTS: SlotMeta[] = [
  { slot: 1, label: "PISTOL", abbr: "P", type: WEAPON_SLOTS[1] },
  { slot: 2, label: "AR",     abbr: "AR", type: WEAPON_SLOTS[2] },
  { slot: 3, label: "SNPR",  abbr: "SN", type: WEAPON_SLOTS[3] },
  { slot: 4, label: "KNIFE", abbr: "K", type: WEAPON_SLOTS[4] },
];

// ---------------------------------------------------------------------------
// Shared style helpers
// ---------------------------------------------------------------------------
const noSelect = {
  userSelect: "none",
  WebkitUserSelect: "none",
  WebkitTapHighlightColor: "transparent",
} as React.CSSProperties;

function glassBtn(
  size: number,
  active: boolean,
  accentColor = ACCENT,
): React.CSSProperties {
  return {
    width: size,
    height: size,
    borderRadius: "50%",
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    background: active
      ? `rgba(76,201,240,0.22)`
      : "rgba(215,226,230,0.06)",
    border: `1px solid ${active ? accentColor : "rgba(215,226,230,0.18)"}`,
    backdropFilter: "blur(4px)",
    boxShadow: active
      ? `0 0 14px rgba(76,201,240,0.35), inset 0 1px 0 rgba(255,255,255,0.06)`
      : "inset 0 1px 0 rgba(255,255,255,0.04)",
    touchAction: "none",
    pointerEvents: "auto",
    cursor: "pointer",
    ...noSelect,
  };
}

// ---------------------------------------------------------------------------
// Virtual Joystick
// ---------------------------------------------------------------------------
function VirtualJoystick() {
  // Track the single active pointer driving the stick
  const activePtr = useRef<number | null>(null);
  // Origin point where the finger landed
  const origin = useRef({ x: 0, y: 0 });
  // Knob DOM ref for direct style mutation (no re-render on pointermove)
  const baseRef = useRef<HTMLDivElement>(null);
  const knobRef = useRef<HTMLDivElement>(null);

  const [visible, setVisible] = useState(false);
  const [originPos, setOriginPos] = useState({ x: 0, y: 0 });

  const show = useCallback((x: number, y: number) => {
    setOriginPos({ x, y });
    setVisible(true);
  }, []);

  const hide = useCallback(() => {
    setVisible(false);
    touch.move(0, 0);
    touch.sprint(false);
    // Reset knob position
    if (knobRef.current) {
      knobRef.current.style.transform = "translate(-50%, -50%)";
    }
  }, []);

  const onPointerDown = useCallback(
    (e: React.PointerEvent<HTMLDivElement>) => {
      if (activePtr.current !== null) return; // only one joystick finger
      e.currentTarget.setPointerCapture(e.pointerId);
      activePtr.current = e.pointerId;
      origin.current = { x: e.clientX, y: e.clientY };
      show(e.clientX, e.clientY);
    },
    [show],
  );

  const onPointerMove = useCallback((e: React.PointerEvent<HTMLDivElement>) => {
    if (e.pointerId !== activePtr.current) return;

    const dx = e.clientX - origin.current.x;
    const dy = e.clientY - origin.current.y;
    const dist = Math.sqrt(dx * dx + dy * dy);
    const clamped = Math.min(dist, STICK_RADIUS);
    const angle = Math.atan2(dy, dx);

    const kx = Math.cos(angle) * clamped;
    const ky = Math.sin(angle) * clamped;

    // Direct DOM mutation for 60fps knob tracking
    if (knobRef.current) {
      knobRef.current.style.transform = `translate(calc(-50% + ${kx}px), calc(-50% + ${ky}px))`;
    }

    const nx = kx / STICK_RADIUS;
    const nz = -(ky / STICK_RADIUS); // screen-y down = negative z (back)

    touch.move(nx, nz);
    touch.sprint(nz > SPRINT_THRESHOLD);
  }, []);

  const onPointerUp = useCallback(
    (e: React.PointerEvent<HTMLDivElement>) => {
      if (e.pointerId !== activePtr.current) return;
      activePtr.current = null;
      hide();
    },
    [hide],
  );

  return (
    <div
      onPointerDown={onPointerDown}
      onPointerMove={onPointerMove}
      onPointerUp={onPointerUp}
      onPointerCancel={onPointerUp}
      style={{
        position: "absolute",
        left: 0,
        top: 0,
        width: STICK_ZONE_W,
        height: "100%",
        touchAction: "none",
        pointerEvents: "auto",
        ...noSelect,
      }}
    >
      {/* Floating base ring - appears where finger lands */}
      {visible && (
        <div
          ref={baseRef}
          style={{
            position: "absolute",
            left: originPos.x,
            top: originPos.y,
            width: STICK_RADIUS * 2,
            height: STICK_RADIUS * 2,
            transform: "translate(-50%, -50%)",
            borderRadius: "50%",
            border: `1px solid rgba(76,201,240,0.25)`,
            background: "rgba(76,201,240,0.04)",
            backdropFilter: "blur(2px)",
            pointerEvents: "none",
          }}
        >
          {/* Inner ring */}
          <div
            style={{
              position: "absolute",
              inset: 10,
              borderRadius: "50%",
              border: "1px solid rgba(76,201,240,0.12)",
            }}
          />
          {/* Knob */}
          <div
            ref={knobRef}
            style={{
              position: "absolute",
              left: "50%",
              top: "50%",
              transform: "translate(-50%, -50%)",
              width: 38,
              height: 38,
              borderRadius: "50%",
              background: "rgba(76,201,240,0.18)",
              border: `1.5px solid rgba(76,201,240,0.55)`,
              backdropFilter: "blur(6px)",
              boxShadow: "0 0 12px rgba(76,201,240,0.3)",
            }}
          />
        </div>
      )}
    </div>
  );
}

// ---------------------------------------------------------------------------
// Look Surface (right side camera drag)
// ---------------------------------------------------------------------------
function LookSurface() {
  // Map pointerId → last client position for delta computation
  const lastPos = useRef<Map<number, { x: number; y: number }>>(new Map());

  const onPointerDown = useCallback((e: React.PointerEvent<HTMLDivElement>) => {
    e.currentTarget.setPointerCapture(e.pointerId);
    lastPos.current.set(e.pointerId, { x: e.clientX, y: e.clientY });
  }, []);

  const onPointerMove = useCallback((e: React.PointerEvent<HTMLDivElement>) => {
    const prev = lastPos.current.get(e.pointerId);
    if (!prev) return;
    const dx = e.clientX - prev.x;
    const dy = e.clientY - prev.y;
    lastPos.current.set(e.pointerId, { x: e.clientX, y: e.clientY });
    touch.look(dx, dy);
  }, []);

  const onPointerUp = useCallback((e: React.PointerEvent<HTMLDivElement>) => {
    lastPos.current.delete(e.pointerId);
  }, []);

  return (
    <div
      onPointerDown={onPointerDown}
      onPointerMove={onPointerMove}
      onPointerUp={onPointerUp}
      onPointerCancel={onPointerUp}
      style={{
        position: "absolute",
        right: 0,
        top: 0,
        // Covers the right portion not taken by joystick zone,
        // but leaves the bottom-right action area passthrough-able via z-index
        width: `calc(100% - ${STICK_ZONE_W})`,
        height: "100%",
        touchAction: "none",
        pointerEvents: "auto",
        // zIndex below buttons so taps on buttons don't bleed through
        zIndex: 1,
        ...noSelect,
      }}
    />
  );
}

// ---------------------------------------------------------------------------
// Action button (fire/aim/jump/reload/crouch)
// ---------------------------------------------------------------------------
interface ActionBtnProps {
  label: string;
  size?: number;
  active?: boolean;
  accentColor?: string;
  onPressStart: () => void;
  onPressEnd?: () => void;
}

function ActionBtn({
  label,
  size = BTN_SIZE,
  active = false,
  accentColor = ACCENT,
  onPressStart,
  onPressEnd,
}: ActionBtnProps) {
  const ptrRef = useRef<number | null>(null);

  const onPointerDown = (e: React.PointerEvent) => {
    e.stopPropagation();
    e.currentTarget.setPointerCapture(e.pointerId);
    ptrRef.current = e.pointerId;
    onPressStart();
  };

  const onPointerUp = (e: React.PointerEvent) => {
    e.stopPropagation();
    if (e.pointerId !== ptrRef.current) return;
    ptrRef.current = null;
    onPressEnd?.();
  };

  return (
    <div
      onPointerDown={onPointerDown}
      onPointerUp={onPointerUp}
      onPointerCancel={onPointerUp}
      style={glassBtn(size, active, accentColor)}
    >
      <span
        style={{
          fontSize: size <= 44 ? "0.5rem" : "0.58rem",
          letterSpacing: "0.12em",
          color: active ? accentColor : FG,
          textShadow: SHADOW,
          fontWeight: active ? 600 : 400,
        }}
      >
        {label}
      </span>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Action button cluster (bottom-right)
// ---------------------------------------------------------------------------
function ActionButtons() {
  const [firingLocal, setFiringLocal] = useState(false);
  const [aimingLocal, setAimingLocal] = useState(false);
  const [crouchActive, setCrouchActive] = useState(false);

  const handleFireStart = useCallback(() => {
    setFiringLocal(true);
    touch.fire(true);
  }, []);
  const handleFireEnd = useCallback(() => {
    setFiringLocal(false);
    touch.fire(false);
  }, []);

  const handleAimStart = useCallback(() => {
    setAimingLocal(true);
    touch.aim(true);
  }, []);
  const handleAimEnd = useCallback(() => {
    setAimingLocal(false);
    touch.aim(false);
  }, []);

  const handleJump = useCallback(() => {
    touch.jump();
  }, []);

  const handleReload = useCallback(() => {
    touch.reload();
  }, []);

  const handleCrouchToggle = useCallback(() => {
    setCrouchActive((prev) => {
      const next = !prev;
      touch.crouch(next);
      return next;
    });
  }, []);

  return (
    <div
      style={{
        position: "absolute",
        right: 18,
        bottom: 22,
        display: "flex",
        flexDirection: "column",
        alignItems: "flex-end",
        gap: 10,
        pointerEvents: "none",
        zIndex: 10,
      }}
    >
      {/* Top row: AIM + JUMP */}
      <div style={{ display: "flex", gap: 10, alignItems: "center" }}>
        <ActionBtn
          label="AIM"
          active={aimingLocal}
          onPressStart={handleAimStart}
          onPressEnd={handleAimEnd}
        />
        <ActionBtn
          label="JUMP"
          onPressStart={handleJump}
        />
      </div>

      {/* Bottom row: CROUCH + FIRE */}
      <div style={{ display: "flex", gap: 10, alignItems: "center" }}>
        <ActionBtn
          label="CROUCH"
          size={BTN_SIZE - 6}
          active={crouchActive}
          accentColor={WARN}
          onPressStart={handleCrouchToggle}
        />
        <ActionBtn
          label="FIRE"
          size={BTN_FIRE_SIZE}
          active={firingLocal}
          accentColor={ACCENT}
          onPressStart={handleFireStart}
          onPressEnd={handleFireEnd}
        />
      </div>

      {/* Reload - slim bar below */}
      <div style={{ width: "100%", display: "flex", justifyContent: "flex-end" }}>
        <ActionBtn
          label="RELOAD"
          size={40}
          accentColor={WARN}
          onPressStart={handleReload}
        />
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Weapon selector strip (right edge, above action buttons)
// ---------------------------------------------------------------------------
function WeaponSelector() {
  const current = useWeaponStore((s) => s.current);
  // Local tapped slot for visual feedback on the frame before store updates
  const [tappedSlot, setTappedSlot] = useState<number | null>(null);

  const handleSlot = useCallback((slot: number) => {
    touch.weapon(slot);
    setTappedSlot(slot);
    // Clear local highlight after a short delay (store will drive it after)
    setTimeout(() => setTappedSlot(null), 200);
  }, []);

  return (
    <div
      style={{
        position: "absolute",
        right: 18,
        // Sit above the action buttons cluster; ~230px bottom offset clears them
        bottom: 230,
        display: "flex",
        flexDirection: "column",
        gap: 6,
        pointerEvents: "none",
        zIndex: 10,
      }}
    >
      {SLOTS.map(({ slot, abbr, type }) => {
        const isActive = current === type || tappedSlot === slot;
        return (
          <div
            key={slot}
            onPointerDown={(e) => {
              e.stopPropagation();
              handleSlot(slot);
            }}
            style={{
              width: 52,
              height: 36,
              borderRadius: 4,
              display: "flex",
              flexDirection: "column",
              alignItems: "center",
              justifyContent: "center",
              background: isActive
                ? "rgba(76,201,240,0.18)"
                : "rgba(215,226,230,0.05)",
              border: `1px solid ${isActive ? ACCENT : "rgba(215,226,230,0.14)"}`,
              backdropFilter: "blur(4px)",
              boxShadow: isActive
                ? "0 0 10px rgba(76,201,240,0.25)"
                : "none",
              touchAction: "none",
              pointerEvents: "auto",
              cursor: "pointer",
              transition: "background 120ms, border-color 120ms, box-shadow 120ms",
              ...noSelect,
            }}
          >
            <span
              style={{
                fontSize: "0.38rem",
                letterSpacing: "0.15em",
                color: isActive ? ACCENT : "rgba(215,226,230,0.4)",
                textShadow: SHADOW,
                lineHeight: 1,
              }}
            >
              {slot}
            </span>
            <span
              style={{
                fontSize: "0.52rem",
                letterSpacing: "0.1em",
                color: isActive ? ACCENT : "rgba(215,226,230,0.6)",
                textShadow: SHADOW,
                fontWeight: isActive ? 600 : 400,
                marginTop: 1,
              }}
            >
              {abbr}
            </span>
          </div>
        );
      })}
    </div>
  );
}

// ---------------------------------------------------------------------------
// Root component
// ---------------------------------------------------------------------------
export function TouchControls() {
  const playing = useWorldStore((s) => s.touchPlaying);
  const health = usePlayerStore((s) => s.health);
  const dead = health <= 0;

  // On death the buttons unmount before their pointerup fires (element-captured),
  // which would leave fire/aim/move latched on. Clear held inputs explicitly so
  // they don't carry into the respawn.
  useEffect(() => {
    if (dead) {
      touch.fire(false);
      touch.aim(false);
      touch.move(0, 0);
      touch.sprint(false);
    }
  }, [dead]);

  if (!playing || dead) return null;

  return (
    <div
      style={{
        position: "fixed",
        inset: 0,
        zIndex: 55,
        pointerEvents: "none",
        touchAction: "none",
        ...noSelect,
      }}
    >
      {/* Left thumb zone - virtual joystick (bottom-left quadrant feel, full-height capture) */}
      <VirtualJoystick />

      {/* Right thumb zone - look/aim drag surface (sits under buttons via z-index) */}
      <LookSurface />

      {/* Weapon selector strip - top-right */}
      <WeaponSelector />

      {/* Action buttons cluster - bottom-right */}
      <ActionButtons />
    </div>
  );
}
