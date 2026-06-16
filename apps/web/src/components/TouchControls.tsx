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
// SVG icon components - pure inline, no external deps
// ---------------------------------------------------------------------------
interface IconProps {
  size?: number;
  color?: string;
}

// Bullet/cartridge silhouette - pointed tip on top, casing body, rim groove near base
function IconBullet({ size = 28, color = "currentColor" }: IconProps) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 28 28"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      style={{ display: "block", filter: "drop-shadow(0 0 3px currentColor)" }}
    >
      {/* Projectile tip - pointed ogive */}
      <path
        d="M14 3 C14 3 10.5 8.5 10.5 12 L17.5 12 C17.5 8.5 14 3 14 3 Z"
        stroke={color}
        strokeWidth="1.1"
        strokeLinejoin="round"
        fill="none"
      />
      {/* Casing body - straight-sided rectangle below ogive */}
      <rect x="10.5" y="12" width="7" height="10" rx="0.5" stroke={color} strokeWidth="1.1" fill="none" />
      {/* Rim groove line near the base - classic extractor groove */}
      <line x1="10.5" y1="20" x2="17.5" y2="20" stroke={color} strokeWidth="1.3" strokeLinecap="round" />
      {/* Case head / rim - slightly wider than body */}
      <rect x="9.5" y="22" width="9" height="3" rx="0.8" stroke={color} strokeWidth="1.1" fill="none" />
    </svg>
  );
}

// Aim-down-sights / scope icon - circle with fine crosshair and dot
function IconAim({ size = 22, color = "currentColor" }: IconProps) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 22 22"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      style={{ display: "block", filter: "drop-shadow(0 0 2px currentColor)" }}
    >
      <circle cx="11" cy="11" r="8.5" stroke={color} strokeWidth="1.1" />
      <circle cx="11" cy="11" r="2.5" stroke={color} strokeWidth="0.9" />
      <circle cx="11" cy="11" r="1" fill={color} />
      <line x1="11" y1="1.5" x2="11" y2="7" stroke={color} strokeWidth="1" strokeLinecap="round" />
      <line x1="11" y1="15" x2="11" y2="20.5" stroke={color} strokeWidth="1" strokeLinecap="round" />
      <line x1="1.5" y1="11" x2="7" y2="11" stroke={color} strokeWidth="1" strokeLinecap="round" />
      <line x1="15" y1="11" x2="20.5" y2="11" stroke={color} strokeWidth="1" strokeLinecap="round" />
    </svg>
  );
}

// Chevron-up / upward arrow for jump
function IconJump({ size = 22, color = "currentColor" }: IconProps) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 22 22"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      style={{ display: "block", filter: "drop-shadow(0 0 2px currentColor)" }}
    >
      {/* Arrow shaft */}
      <line x1="11" y1="18" x2="11" y2="6" stroke={color} strokeWidth="1.5" strokeLinecap="round" />
      {/* Arrowhead */}
      <polyline points="6,11 11,5.5 16,11" stroke={color} strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" fill="none" />
      {/* Ground bar */}
      <line x1="5" y1="18.5" x2="17" y2="18.5" stroke={color} strokeWidth="1.2" strokeLinecap="round" />
    </svg>
  );
}

// Circular refresh arrow for reload
function IconReload({ size = 20, color = "currentColor" }: IconProps) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 20 20"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      style={{ display: "block", filter: "drop-shadow(0 0 2px currentColor)" }}
    >
      {/* Arc - 3/4 circle going clockwise */}
      <path
        d="M 10 3 A 7 7 0 1 1 3.5 13.5"
        stroke={color}
        strokeWidth="1.4"
        strokeLinecap="round"
        fill="none"
      />
      {/* Arrowhead at arc tail */}
      <polyline points="3.5,17.5 3.5,13.5 7.5,13.5" stroke={color} strokeWidth="1.4" strokeLinecap="round" strokeLinejoin="round" fill="none" />
    </svg>
  );
}

// Chevron-down + bar for crouch
function IconCrouch({ size = 22, color = "currentColor" }: IconProps) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 22 22"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      style={{ display: "block", filter: "drop-shadow(0 0 2px currentColor)" }}
    >
      {/* Chevron down */}
      <polyline points="6,7 11,13 16,7" stroke={color} strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" fill="none" />
      {/* Second chevron, slightly smaller */}
      <polyline points="7.5,11 11,15.5 14.5,11" stroke={color} strokeWidth="1" strokeLinecap="round" strokeLinejoin="round" fill="none" />
      {/* Ground bar */}
      <line x1="5" y1="18.5" x2="17" y2="18.5" stroke={color} strokeWidth="1.4" strokeLinecap="round" />
    </svg>
  );
}

// --- Weapon icons ---

// Pistol - compact barrel + grip silhouette
function IconPistol({ size = 20, color = "currentColor" }: IconProps) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      style={{ display: "block" }}
    >
      {/* Barrel */}
      <rect x="3" y="9" width="14" height="4" rx="1" stroke={color} strokeWidth="1.2" fill="none" />
      {/* Slide top */}
      <rect x="7" y="7" width="9" height="2" rx="0.5" stroke={color} strokeWidth="1" fill="none" />
      {/* Trigger guard + grip */}
      <path d="M 13 13 L 13 19 Q 13 21 15 21 L 17 21 Q 19 21 19 19 L 19 13 Z" stroke={color} strokeWidth="1.1" fill="none" strokeLinejoin="round" />
      {/* Trigger */}
      <line x1="15.5" y1="13.5" x2="15.5" y2="16.5" stroke={color} strokeWidth="1" strokeLinecap="round" />
    </svg>
  );
}

// AR / Assault Rifle - longer barrel, box magazine
function IconAR({ size = 20, color = "currentColor" }: IconProps) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 26 18"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      style={{ display: "block" }}
    >
      {/* Long barrel */}
      <line x1="1" y1="7" x2="10" y2="7" stroke={color} strokeWidth="1.3" strokeLinecap="round" />
      {/* Receiver body */}
      <rect x="9" y="4.5" width="11" height="5" rx="1" stroke={color} strokeWidth="1.2" fill="none" />
      {/* Carry handle / stock */}
      <path d="M 20 5 L 25 5 L 25 9.5" stroke={color} strokeWidth="1.2" strokeLinecap="round" strokeLinejoin="round" fill="none" />
      {/* Magazine */}
      <rect x="13" y="9.5" width="4" height="6" rx="0.8" stroke={color} strokeWidth="1.1" fill="none" />
      {/* Trigger */}
      <line x1="14.5" y1="9.5" x2="14.5" y2="12" stroke={color} strokeWidth="1" strokeLinecap="round" />
    </svg>
  );
}

// Sniper - long barrel + scope on top
function IconSniper({ size = 20, color = "currentColor" }: IconProps) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 28 16"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      style={{ display: "block" }}
    >
      {/* Long barrel */}
      <line x1="1" y1="9" x2="12" y2="9" stroke={color} strokeWidth="1.4" strokeLinecap="round" />
      {/* Receiver */}
      <rect x="11" y="6.5" width="11" height="5" rx="1" stroke={color} strokeWidth="1.2" fill="none" />
      {/* Stock */}
      <path d="M 22 7 L 27 7 L 27 11" stroke={color} strokeWidth="1.2" strokeLinecap="round" strokeLinejoin="round" fill="none" />
      {/* Scope cylinder */}
      <rect x="13" y="3" width="7" height="3" rx="1.5" stroke={color} strokeWidth="1.1" fill="none" />
      {/* Scope mount lines */}
      <line x1="15" y1="6" x2="15" y2="6.5" stroke={color} strokeWidth="1" strokeLinecap="round" />
      <line x1="18" y1="6" x2="18" y2="6.5" stroke={color} strokeWidth="1" strokeLinecap="round" />
    </svg>
  );
}

// Knife - blade silhouette
function IconKnife({ size = 20, color = "currentColor" }: IconProps) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 22 22"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      style={{ display: "block" }}
    >
      {/* Blade */}
      <path d="M 5 17 L 17 5 Q 19 3 20 4 Q 21 5 19 7 L 7 19 Z" stroke={color} strokeWidth="1.1" fill="none" strokeLinejoin="round" />
      {/* Guard */}
      <line x1="7" y1="15" x2="9" y2="17" stroke={color} strokeWidth="1.8" strokeLinecap="round" />
      {/* Handle */}
      <path d="M 4 18 L 3 19 Q 2 20 3 21 L 4 21 L 7 18 Z" stroke={color} strokeWidth="1" fill="none" strokeLinejoin="round" />
    </svg>
  );
}

// Small cycle/refresh arrow indicator for weapon button
function IconCycle({ size = 12, color = "currentColor" }: IconProps) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 12 12"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      style={{ display: "block" }}
    >
      <path
        d="M 6 1.5 A 4.5 4.5 0 1 1 2 8"
        stroke={color}
        strokeWidth="1.2"
        strokeLinecap="round"
        fill="none"
      />
      <polyline points="2,10.5 2,8 4.5,8" stroke={color} strokeWidth="1.2" strokeLinecap="round" strokeLinejoin="round" fill="none" />
    </svg>
  );
}

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
  label: string; // used only as aria-label for accessibility
  icon: React.ReactNode;
  size?: number;
  active?: boolean;
  accentColor?: string;
  onPressStart: () => void;
  onPressEnd?: () => void;
}

function ActionBtn({
  label,
  icon,
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
      aria-label={label}
      role="button"
      onPointerDown={onPointerDown}
      onPointerUp={onPointerUp}
      onPointerCancel={onPointerUp}
      style={{
        ...glassBtn(size, active, accentColor),
        color: active ? accentColor : FG,
      }}
    >
      {icon}
    </div>
  );
}

// ---------------------------------------------------------------------------
// Fire button - holds to fire AND doubles as a look pad: dragging the same
// finger pans the camera (touch.look) so the player can fire + aim one-handed.
// Only the fire button gets this behaviour.
// ---------------------------------------------------------------------------
function FireButton() {
  const [active, setActive] = useState(false);
  const ptr = useRef<number | null>(null);
  const last = useRef({ x: 0, y: 0 });

  const onPointerDown = (e: React.PointerEvent) => {
    e.stopPropagation();
    e.currentTarget.setPointerCapture(e.pointerId);
    ptr.current = e.pointerId;
    last.current = { x: e.clientX, y: e.clientY };
    setActive(true);
    touch.fire(true);
  };

  const onPointerMove = (e: React.PointerEvent) => {
    if (e.pointerId !== ptr.current) return;
    const dx = e.clientX - last.current.x;
    const dy = e.clientY - last.current.y;
    last.current = { x: e.clientX, y: e.clientY };
    touch.look(dx, dy);
  };

  const onPointerUp = (e: React.PointerEvent) => {
    e.stopPropagation();
    if (e.pointerId !== ptr.current) return;
    ptr.current = null;
    setActive(false);
    touch.fire(false);
  };

  return (
    <div
      aria-label="Fire"
      role="button"
      onPointerDown={onPointerDown}
      onPointerMove={onPointerMove}
      onPointerUp={onPointerUp}
      onPointerCancel={onPointerUp}
      style={{
        ...glassBtn(BTN_FIRE_SIZE, active, ACCENT),
        color: active ? ACCENT : FG,
      }}
    >
      <IconBullet size={28} color={active ? ACCENT : FG} />
    </div>
  );
}

// ---------------------------------------------------------------------------
// Action button cluster (bottom-right)
// ---------------------------------------------------------------------------
function ActionButtons() {
  const [aimActive, setAimActive] = useState(false);
  const [crouchActive, setCrouchActive] = useState(false);

  const handleAimToggle = useCallback(() => {
    setAimActive((prev) => {
      const next = !prev;
      touch.aim(next);
      return next;
    });
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
          icon={<IconAim size={22} color={aimActive ? ACCENT : FG} />}
          active={aimActive}
          onPressStart={handleAimToggle}
        />
        <ActionBtn
          label="JUMP"
          icon={<IconJump size={22} color={FG} />}
          onPressStart={handleJump}
        />
      </div>

      {/* Bottom row: CROUCH + FIRE */}
      <div style={{ display: "flex", gap: 10, alignItems: "center" }}>
        <ActionBtn
          label="CROUCH"
          icon={<IconCrouch size={20} color={crouchActive ? WARN : FG} />}
          size={BTN_SIZE - 6}
          active={crouchActive}
          accentColor={WARN}
          onPressStart={handleCrouchToggle}
        />
        <FireButton />
      </div>

      {/* Reload - slim bar below */}
      <div style={{ width: "100%", display: "flex", justifyContent: "flex-end" }}>
        <ActionBtn
          label="RELOAD"
          icon={<IconReload size={18} color={WARN} />}
          size={40}
          accentColor={WARN}
          onPressStart={handleReload}
        />
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Weapon cycle button (right edge, above action buttons). One tap = next weapon.
// ---------------------------------------------------------------------------
function WeaponCycleButton() {
  const current = useWeaponStore((s) => s.current);
  const idx = SLOTS.findIndex((s) => s.type === current);
  const cur = SLOTS[idx >= 0 ? idx : 0];

  const cycle = useCallback((e: React.PointerEvent) => {
    e.stopPropagation();
    // Read live so rapid taps step through the slots in order.
    const live = useWeaponStore.getState().current;
    const i = SLOTS.findIndex((s) => s.type === live);
    const next = SLOTS[(i + 1) % SLOTS.length];
    touch.weapon(next.slot);
  }, []);

  // Pick the right weapon icon based on current weapon type
  const WeaponIcon = (() => {
    switch (cur.type) {
      case WeaponType.Pistol:  return IconPistol;
      case WeaponType.AR:      return IconAR;
      case WeaponType.Sniper:  return IconSniper;
      case WeaponType.Knife:   return IconKnife;
      default:                 return IconPistol;
    }
  })();

  return (
    <div
      aria-label="Switch weapon"
      role="button"
      onPointerDown={cycle}
      style={{
        position: "absolute",
        right: 18,
        // Sit above the action buttons cluster.
        bottom: 250,
        width: 64,
        height: 56,
        borderRadius: 6,
        display: "flex",
        flexDirection: "column",
        alignItems: "center",
        justifyContent: "center",
        gap: 4,
        background: "rgba(76,201,240,0.10)",
        border: `1px solid rgba(76,201,240,0.3)`,
        backdropFilter: "blur(4px)",
        boxShadow: "0 0 10px rgba(76,201,240,0.18)",
        touchAction: "none",
        pointerEvents: "auto",
        cursor: "pointer",
        zIndex: 10,
        color: ACCENT,
        ...noSelect,
      }}
    >
      {/* Per-weapon icon in accent color */}
      <div
        style={{
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          filter: `drop-shadow(0 0 3px ${ACCENT})`,
          color: ACCENT,
        }}
      >
        <WeaponIcon size={22} color={ACCENT} />
      </div>
      {/* Weapon abbr label - tiny, keeps orientation clear */}
      <span
        style={{
          fontSize: "0.46rem",
          letterSpacing: "0.14em",
          color: ACCENT,
          textShadow: SHADOW,
          fontWeight: 600,
          lineHeight: 1,
        }}
      >
        {cur.abbr}
      </span>
      {/* Cycle indicator icon */}
      <div style={{ color: "rgba(215,226,230,0.4)" }}>
        <IconCycle size={11} color="rgba(215,226,230,0.4)" />
      </div>
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

      {/* Weapon cycle button - tap to switch to next weapon */}
      <WeaponCycleButton />

      {/* Action buttons cluster - bottom-right */}
      <ActionButtons />
    </div>
  );
}
