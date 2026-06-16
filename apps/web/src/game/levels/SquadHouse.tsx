"use client";

import { useEffect, useMemo } from "react";
import * as THREE from "three";
import { RigidBody, CuboidCollider } from "@react-three/rapier";
import { mergeGeometries } from "three/examples/jsm/utils/BufferGeometryUtils.js";
import { MAT } from "@/game/levels/materials";
import { BreakableWindow } from "@/game/levels/BreakableWindow";

export interface SquadHouseProps {
  position: [number, number, number];
  rotationY?: number;
  variant?: 0 | 1 | 2 | 3;
  alt?: boolean;
}

// ── shared constants ───────────────────────────────────────────────────────────
const STOREY_H = 2.8;
const WALL_T = 0.25;
const PLINTH_H = 0.35;
const FLOOR_T = 0.2;
const DOOR_W = 1.1;
const DOOR_H = 2.1;
const SILL = 1.0;   // window sill height above each storey floor
const WW = 1.5;     // window opening width
const WH = 1.3;     // window opening height

// ── building dimensions ────────────────────────────────────────────────────────
const W = 12;
const D = 10;
const halfW = W / 2;    // 6
const halfD = D / 2;    // 5
const floorY = PLINTH_H; // 0.35 — ground floor bottom
const H = 2 * STOREY_H; // 5.6 — total outer wall height
const wallTop = floorY + H; // 5.95

// wall face centres (outer face ± half-thickness)
const ZF = halfD - WALL_T / 2;   //  4.875 (front face centre)
const ZB = -(halfD - WALL_T / 2); // -4.875 (back face centre)
const XL = -(halfW - WALL_T / 2); // -5.875 (left face centre)
const XR = halfW - WALL_T / 2;   //  5.875 (right face centre)

// inner floor/ceiling extents
const INNER_W = W - 2 * WALL_T; // 11.5
const INNER_D = D - 2 * WALL_T; // 9.5
const INNER_X0 = -halfW + WALL_T; // -5.75 (inner left edge)
const INNER_Z0 = -halfD + WALL_T; // -4.75 (inner back edge)

// stair run parameters (interior stair in left bay)
const SW = 2.0;       // stair run width (X)
const LANDING = 1.0;  // landing depth each end
const STAIR_X_CTR = INNER_X0 + SW / 2; // -4.75
const STAIR_Z0 = INNER_Z0 + LANDING;   // -3.75 (run start)
const STAIR_Z1 = -INNER_Z0 - LANDING;  // +3.75 (run end)
const STAIR_RUN = STAIR_Z1 - STAIR_Z0; // 7.5
const N_STEPS = 13;
const STEP_H = STOREY_H / N_STEPS;
const TREAD = STAIR_RUN / N_STEPS;

// exterior stair (ground → roof, back-left corner)
// Navigable path: stand on ground → climb exterior stair → step onto roof.
// Rises from y=floorY (ground) at z=-8.0 toward z=-5.5 (back wall outer face).
// Full rise = 2*STOREY_H (5.6m) so top step y == ROOF_Y (5.95). ✓
const EXT_STAIR_W = 1.2;
const EXT_STAIR_X_CTR = -halfW + EXT_STAIR_W / 2; // -5.4
const EXT_STAIR_Z_FAR = -(halfD + 3.0); // -8.0 (base, far from building)
const EXT_STAIR_Z_NEAR = -(halfD + 0.5); // -5.5 (top, arrives at back parapet gap)
const EXT_STAIR_Z_RUN = EXT_STAIR_Z_FAR - EXT_STAIR_Z_NEAR; // -2.5 (negative — climbs toward building)
const EXT_TREAD_Z = EXT_STAIR_Z_RUN / N_STEPS; // -0.1923 per step
const EXT_STEP_H = (2 * STOREY_H) / N_STEPS;   // full ground→roof rise per step (~0.431m < 0.5m autostep ✓)
const EXT_BASE_Y = floorY;                       // 0.35 — base at ground so stair is accessible without a jump

// roof
const ROOF_Y = floorY + 2 * STOREY_H; // 5.95

// ── segment types ──────────────────────────────────────────────────────────────
interface Seg {
  s: [number, number, number];
  p: [number, number, number];
  mat: THREE.Material;
}
interface Win {
  pos: [number, number, number];
  facing: "z" | "x";
}
interface MergedMesh {
  geo: THREE.BufferGeometry;
  mat: THREE.Material;
}

/**
 * PUBG-style 2-storey squad house.
 *
 * Footprint W=12, D=10. Two full storeys (each STOREY_H=2.8m).
 * Features:
 *  - Front door (left) + front window (right), upper front window + balcony
 *  - Back door (right) + back window (left), upper back door for roof stair access
 *  - Left/right walls: one window per storey (centred)
 *  - Interior longitudinal wall (x=+1) splitting into two bays, with doorway gaps
 *  - Second-floor transverse wall stub creating a third room
 *  - Interior staircase in left bay (ground → floor 2)
 *  - Exterior staircase (ground → roof, back-left corner) — full-height run, no jump needed
 *  - Accessible flat roof with parapet walls
 *  - Variant-driven visual details (0=porch, 1=flower boxes, 2=foundation, 3=panels)
 */
export function SquadHouse({
  position,
  rotationY = 0,
  variant = 0,
  alt = false,
}: SquadHouseProps) {
  const wallMat = alt ? MAT.plasterAlt : MAT.plaster;
  const headerH = STOREY_H - SILL - WH; // 0.5

  // ── geometry computation ─────────────────────────────────────────────────────
  const { walls, decor, windows } = useMemo(() => {
    const walls: Seg[] = [];
    const decor: Seg[] = [];
    const windows: Win[] = [];

    const shutterMat: THREE.Material = variant === 1 ? MAT.doorWood : MAT.woodTrim;

    // ── helpers ────────────────────────────────────────────────────────────────

    /** Add standard window opening into a Z-facing wall (runs along X).
     *  Pushes 2 wall pieces (sill strip + header strip) into walls/decor.
     *  The two side pillars must be handled by the caller because the front wall
     *  has compound openings; use addWindowPillarsZ for single-window side walls. */
    const addWindowOpeningZ = (
      xCtr: number,
      base: number,
      zc: number,
    ) => {
      walls.push({ s: [WW, SILL, WALL_T], p: [xCtr, base + SILL / 2, zc], mat: wallMat });
      walls.push({ s: [WW, headerH, WALL_T], p: [xCtr, base + SILL + WH + headerH / 2, zc], mat: wallMat });
      // sill ledge decor
      decor.push({ s: [WW + 0.2, 0.1, WALL_T + 0.08], p: [xCtr, base + SILL, zc], mat: MAT.woodTrim });
      // shutters
      const shutterOffX = WW / 2 + 0.1;
      const shutterS: [number, number, number] = [0.15, WH + 0.1, 0.06];
      decor.push({ s: shutterS, p: [xCtr - shutterOffX, base + SILL + WH / 2, zc], mat: shutterMat });
      decor.push({ s: shutterS, p: [xCtr + shutterOffX, base + SILL + WH / 2, zc], mat: shutterMat });
      // variant 1 flower boxes on ground-floor windows only
      if (variant === 1 && base === floorY) {
        decor.push({ s: [WW * 0.8, 0.2, 0.25], p: [xCtr, base + SILL - 0.1, zc], mat: MAT.stoneBase });
      }
      windows.push({ pos: [xCtr, base + SILL + WH / 2, zc], facing: "z" });
    };


    // ────────────────────────────────────────────────────────────────────────────
    // STOREY LOOP (0 = ground, 1 = upper)
    // ────────────────────────────────────────────────────────────────────────────
    for (let s = 0; s < 2; s++) {
      const base = floorY + s * STOREY_H;

      // ── FRONT WALL (z=ZF, runs X=-6..+6) ─────────────────────────────────────
      // Ground floor: door @ x=-3 (left) + window @ x=+2.5 (right)
      // Upper floor: window @ x=+2.5 only
      if (s === 0) {
        // Ground floor front: 5-column decomposition
        // Col A: x=-6 to -3.55, w=2.45
        walls.push({ s: [2.45, STOREY_H, WALL_T], p: [-4.775, base + STOREY_H / 2, ZF], mat: wallMat });
        // Col B (door): header only
        walls.push({ s: [DOOR_W, STOREY_H - DOOR_H, WALL_T], p: [-3.0, base + DOOR_H + (STOREY_H - DOOR_H) / 2, ZF], mat: wallMat });
        // Col C: x=-2.45 to +1.75, w=4.2
        walls.push({ s: [4.2, STOREY_H, WALL_T], p: [-0.35, base + STOREY_H / 2, ZF], mat: wallMat });
        // Col D (window): sill + header
        addWindowOpeningZ(2.5, base, ZF);
        // Col E: x=+3.25 to +6, w=2.75
        walls.push({ s: [2.75, STOREY_H, WALL_T], p: [4.625, base + STOREY_H / 2, ZF], mat: wallMat });

        // door surround decor
        decor.push({ s: [DOOR_W, DOOR_H, 0.08], p: [-3.0, base + DOOR_H / 2, ZF], mat: MAT.doorWood });
        decor.push({ s: [DOOR_W + 0.2, DOOR_H + 0.12, 0.12], p: [-3.0, base + DOOR_H / 2, ZF - WALL_T + 0.04], mat: MAT.woodTrim });
      } else {
        // Upper floor front: window @ x=+2.5, full wall left of it
        // Left panel: x=-6 to +1.75, w=7.75
        walls.push({ s: [7.75, STOREY_H, WALL_T], p: [-2.125, base + STOREY_H / 2, ZF], mat: wallMat });
        // Window col
        addWindowOpeningZ(2.5, base, ZF);
        // Right panel: x=+3.25 to +6, w=2.75
        walls.push({ s: [2.75, STOREY_H, WALL_T], p: [4.625, base + STOREY_H / 2, ZF], mat: wallMat });
      }

      // ── BACK WALL (z=ZB, runs X=-6..+6) ──────────────────────────────────────
      // Ground floor: window @ x=-2.5 (left) + door @ x=+2.0 (right)
      // Upper floor: window @ x=-2.5 (left) + DOOR @ x=+2.0 (right) for roof stair access
      if (s === 0) {
        // Ground floor back: 5-column decomposition
        // Col A: x=-6 to -3.25, w=2.75
        walls.push({ s: [2.75, STOREY_H, WALL_T], p: [-4.625, base + STOREY_H / 2, ZB], mat: wallMat });
        // Col B (window): sill + header
        addWindowOpeningZ(-2.5, base, ZB);
        // Col C: x=-1.75 to +1.45, w=3.2
        walls.push({ s: [3.2, STOREY_H, WALL_T], p: [-0.15, base + STOREY_H / 2, ZB], mat: wallMat });
        // Col D (rear door): header only
        walls.push({ s: [DOOR_W, STOREY_H - DOOR_H, WALL_T], p: [2.0, base + DOOR_H + (STOREY_H - DOOR_H) / 2, ZB], mat: wallMat });
        // Col E: x=+2.55 to +6, w=3.45
        walls.push({ s: [3.45, STOREY_H, WALL_T], p: [4.275, base + STOREY_H / 2, ZB], mat: wallMat });

        // rear door surround
        decor.push({ s: [DOOR_W, DOOR_H, 0.08], p: [2.0, base + DOOR_H / 2, ZB], mat: MAT.doorWood });
        decor.push({ s: [DOOR_W + 0.2, DOOR_H + 0.12, 0.12], p: [2.0, base + DOOR_H / 2, ZB + WALL_T - 0.04], mat: MAT.woodTrim });
      } else {
        // Upper floor back: window @ x=-2.5, door @ x=+2.0 for roof stair access
        // Col A: x=-6 to -3.25, w=2.75
        walls.push({ s: [2.75, STOREY_H, WALL_T], p: [-4.625, base + STOREY_H / 2, ZB], mat: wallMat });
        // Col B (window): sill + header
        addWindowOpeningZ(-2.5, base, ZB);
        // Col C: x=-1.75 to +1.45, w=3.2
        walls.push({ s: [3.2, STOREY_H, WALL_T], p: [-0.15, base + STOREY_H / 2, ZB], mat: wallMat });
        // Col D (upper back door for roof stair): header only
        walls.push({ s: [DOOR_W, STOREY_H - DOOR_H, WALL_T], p: [2.0, base + DOOR_H + (STOREY_H - DOOR_H) / 2, ZB], mat: wallMat });
        // Col E: x=+2.55 to +6, w=3.45
        walls.push({ s: [3.45, STOREY_H, WALL_T], p: [4.275, base + STOREY_H / 2, ZB], mat: wallMat });

        // upper back door surround
        decor.push({ s: [DOOR_W, DOOR_H, 0.08], p: [2.0, base + DOOR_H / 2, ZB], mat: MAT.doorWood });
        decor.push({ s: [DOOR_W + 0.2, DOOR_H + 0.12, 0.12], p: [2.0, base + DOOR_H / 2, ZB + WALL_T - 0.04], mat: MAT.woodTrim });
      }

      // ── LEFT WALL (x=XL, runs Z=-5..+5) ─────────────────────────────────────
      // One window per storey, centred at z=0
      // pillarD = (D - WW) / 2 = 4.25
      const pillarD = (D - WW) / 2; // 4.25
      // sill + header strips spanning full D
      walls.push({ s: [WALL_T, SILL, D], p: [XL, base + SILL / 2, 0], mat: wallMat });
      walls.push({ s: [WALL_T, headerH, D], p: [XL, base + SILL + WH + headerH / 2, 0], mat: wallMat });
      // side pillars flanking the window opening
      walls.push({ s: [WALL_T, WH, pillarD], p: [XL, base + SILL + WH / 2, -(halfD - pillarD / 2)], mat: wallMat });
      walls.push({ s: [WALL_T, WH, pillarD], p: [XL, base + SILL + WH / 2, +(halfD - pillarD / 2)], mat: wallMat });
      // sill ledge decor + shutters (reuse helper for decor/windows only, skip wall segs)
      decor.push({ s: [WALL_T + 0.08, 0.1, WW + 0.2], p: [XL, base + SILL, 0], mat: MAT.woodTrim });
      {
        const shutterOffZ = WW / 2 + 0.1;
        const shutterS: [number, number, number] = [0.06, WH + 0.1, 0.15];
        const shmAt: THREE.Material = variant === 1 ? MAT.doorWood : MAT.woodTrim;
        decor.push({ s: shutterS, p: [XL, base + SILL + WH / 2, -shutterOffZ], mat: shmAt });
        decor.push({ s: shutterS, p: [XL, base + SILL + WH / 2, +shutterOffZ], mat: shmAt });
        if (variant === 1 && base === floorY) {
          decor.push({ s: [0.25, 0.2, WW * 0.8], p: [XL, base + SILL - 0.1, 0], mat: MAT.stoneBase });
        }
      }
      windows.push({ pos: [XL, base + SILL + WH / 2, 0], facing: "x" });

      // ── RIGHT WALL (x=XR, runs Z=-5..+5) ─────────────────────────────────────
      walls.push({ s: [WALL_T, SILL, D], p: [XR, base + SILL / 2, 0], mat: wallMat });
      walls.push({ s: [WALL_T, headerH, D], p: [XR, base + SILL + WH + headerH / 2, 0], mat: wallMat });
      walls.push({ s: [WALL_T, WH, pillarD], p: [XR, base + SILL + WH / 2, -(halfD - pillarD / 2)], mat: wallMat });
      walls.push({ s: [WALL_T, WH, pillarD], p: [XR, base + SILL + WH / 2, +(halfD - pillarD / 2)], mat: wallMat });
      decor.push({ s: [WALL_T + 0.08, 0.1, WW + 0.2], p: [XR, base + SILL, 0], mat: MAT.woodTrim });
      {
        const shutterOffZ = WW / 2 + 0.1;
        const shutterS: [number, number, number] = [0.06, WH + 0.1, 0.15];
        const shmAt: THREE.Material = variant === 1 ? MAT.doorWood : MAT.woodTrim;
        decor.push({ s: shutterS, p: [XR, base + SILL + WH / 2, -shutterOffZ], mat: shmAt });
        decor.push({ s: shutterS, p: [XR, base + SILL + WH / 2, +shutterOffZ], mat: shmAt });
        if (variant === 1 && base === floorY) {
          decor.push({ s: [0.25, 0.2, WW * 0.8], p: [XR, base + SILL - 0.1, 0], mat: MAT.stoneBase });
        }
      }
      windows.push({ pos: [XR, base + SILL + WH / 2, 0], facing: "x" });

      // ── INTERIOR LONGITUDINAL WALL (x=+1.0, along Z) ─────────────────────────
      // Runs from z=INNER_Z0 to z=-INNER_Z0, total INNER_D=9.5
      // Doorway gap: DOOR_W=1.1 centred at z=-1.0
      // Segment A: z=-4.75 to -1.55, len=3.2, ctr=-3.15
      walls.push({ s: [WALL_T, STOREY_H, 3.2], p: [1.0, base + STOREY_H / 2, -3.15], mat: wallMat });
      // Header above doorway
      walls.push({ s: [WALL_T, STOREY_H - DOOR_H, DOOR_W], p: [1.0, base + DOOR_H + (STOREY_H - DOOR_H) / 2, -1.0], mat: wallMat });
      // Segment B: z=-0.45 to +4.75, len=5.2, ctr=+2.15
      walls.push({ s: [WALL_T, STOREY_H, 5.2], p: [1.0, base + STOREY_H / 2, 2.15], mat: wallMat });
    }

    // ── SECOND-FLOOR TRANSVERSE WALL STUB ───────────────────────────────────────
    // z=0 plane, running X from x=-3.55 to x_int=+1.0.
    // Segment A starts at x=-3.55 (not -5.75) to clear the stairwell column
    // (x:-5.75..-3.75) and give the climber unclipped headroom. ✓
    // Door gap DOOR_W=1.1 centred at x=-1.0
    // Segment A: x=-3.55 to -1.55, w=2.0, ctr=-2.55
    // Header: x=-1.55 to -0.45 (DOOR_W=1.1), top portion
    // Segment B: x=-0.45 to +1.0, w=1.45, ctr=+0.275
    {
      const base2 = floorY + STOREY_H; // 3.15
      walls.push({ s: [2.0, STOREY_H, WALL_T], p: [-2.55, base2 + STOREY_H / 2, 0], mat: wallMat });
      walls.push({ s: [DOOR_W, STOREY_H - DOOR_H, WALL_T], p: [-1.0, base2 + DOOR_H + (STOREY_H - DOOR_H) / 2, 0], mat: wallMat });
      walls.push({ s: [1.45, STOREY_H, WALL_T], p: [0.275, base2 + STOREY_H / 2, 0], mat: wallMat });
    }

    // ── UPPER FLOOR SLAB ─────────────────────────────────────────────────────────
    // Sits at y=floorY+STOREY_H=3.15 (top face). Stair hole: x=-5.75..-3.75, z=-3.75..+3.75
    {
      const fy = floorY + STOREY_H; // 3.15
      // Piece 1: right column (x=-3.75..+5.75), full depth
      walls.push({ s: [INNER_W - SW, FLOOR_T, INNER_D], p: [1.0, fy, 0], mat: MAT.woodTrim });
      // Piece 2: back landing (stair bottom, SW wide × LANDING deep)
      walls.push({ s: [SW, FLOOR_T, LANDING], p: [STAIR_X_CTR, fy, INNER_Z0 + LANDING / 2], mat: MAT.woodTrim });
      // Piece 3: front landing (stair top, SW wide × LANDING deep)
      walls.push({ s: [SW, FLOOR_T, LANDING], p: [STAIR_X_CTR, fy, -INNER_Z0 - LANDING / 2], mat: MAT.woodTrim });
    }

    // ── INTERIOR STAIRCASE (ground → floor 2) ─────────────────────────────────
    // SW=2.0 wide in X, rising along +Z from STAIR_Z0=-3.75 to STAIR_Z1=+3.75
    for (let i = 0; i < N_STEPS; i++) {
      const h = (i + 1) * STEP_H;
      walls.push({
        s: [SW * 0.92, h, TREAD + 0.01],
        p: [STAIR_X_CTR, floorY + h / 2, STAIR_Z0 + (i + 0.5) * TREAD],
        mat: MAT.stoneBase,
      });
    }

    // ── EXTERIOR STAIRCASE (ground → roof, back-left corner) ─────────────────
    // i=0 is the bottom step (far side, z≈-8.0), i=N_STEPS-1 is the top step (z≈-5.5).
    // EXT_TREAD_Z is negative so subtracting it moves z toward building (+Z direction).
    // Top step: y = EXT_BASE_Y + N_STEPS*EXT_STEP_H = floorY + 2*STOREY_H = ROOF_Y ✓
    for (let i = 0; i < N_STEPS; i++) {
      const h = (i + 1) * EXT_STEP_H;
      // z climbs from far (-8.0) toward near (-5.5); EXT_TREAD_Z is negative
      const zCtr = EXT_STAIR_Z_FAR - (i + 0.5) * EXT_TREAD_Z; // subtract negative = add
      walls.push({
        s: [EXT_STAIR_W * 0.92, h, Math.abs(EXT_TREAD_Z) + 0.01],
        p: [EXT_STAIR_X_CTR, EXT_BASE_Y + h / 2, zCtr],
        mat: MAT.stoneBase,
      });
    }

    // ── ROOF SLAB ──────────────────────────────────────────────────────────────
    // Flat at y=ROOF_Y=5.95.
    // The exterior stair arrives at x≈-5.4, z≈-5.5 at roof height, stepping through the
    // back parapet gap (x=-6..-4.8). The left strip must extend all the way to z=-5 so
    // there is solid roof immediately at the stair top — no void between stair and slab.
    // Piece 1: right column x=-4.8..+6 (w=10.8), full Z depth
    walls.push({ s: [10.8, FLOOR_T, D], p: [0.6, ROOF_Y, 0], mat: MAT.concrete });
    // Piece 2: left column x=-6..-4.8 (w=1.2), full Z depth (z=-5..+5)
    // Extends to the back parapet so the stair top has solid landing. ✓
    walls.push({ s: [1.2, FLOOR_T, D], p: [-5.4, ROOF_Y, 0], mat: MAT.concrete });

    // ── PARAPET WALLS ──────────────────────────────────────────────────────────
    // height=0.9, sitting on roof (bottom at ROOF_Y, centre at ROOF_Y+0.45)
    const parY = ROOF_Y + 0.45;
    // Front parapet: full width W=12
    walls.push({ s: [W, 0.9, WALL_T], p: [0, parY, halfD], mat: MAT.concrete });
    // Back parapet: hole for stair opening (x=-6..-4.8, w=1.2), single right piece w=10.8
    walls.push({ s: [10.8, 0.9, WALL_T], p: [0.6, parY, -halfD], mat: MAT.concrete });
    // Left parapet
    walls.push({ s: [WALL_T, 0.9, D], p: [-halfW, parY, 0], mat: MAT.concrete });
    // Right parapet
    walls.push({ s: [WALL_T, 0.9, D], p: [halfW, parY, 0], mat: MAT.concrete });

    // ── BALCONY (front face, right side, upper floor) ─────────────────────────
    // Slab: [3.5, FLOOR_T, 1.2] at y=floorY+STOREY_H, protruding from front wall
    const balconyY = floorY + STOREY_H; // 3.15
    walls.push({ s: [3.5, FLOOR_T, 1.2], p: [2.5, balconyY, halfD + 0.6], mat: MAT.concrete });
    // Balcony parapet railings
    decor.push({ s: [3.5, 0.9, WALL_T], p: [2.5, balconyY + 0.45, halfD + 1.2], mat: MAT.concrete }); // front
    decor.push({ s: [WALL_T, 0.9, 1.2], p: [0.875, balconyY + 0.45, halfD + 0.6], mat: MAT.concrete }); // left
    decor.push({ s: [WALL_T, 0.9, 1.2], p: [4.125, balconyY + 0.45, halfD + 0.6], mat: MAT.concrete }); // right
    // balcony posts
    const postH = 0.9;
    const postY = balconyY + postH / 2;
    for (let b = -1; b <= 1; b++) {
      decor.push({ s: [0.08, postH, 0.08], p: [2.5 + b * 1.2, postY, halfD + 1.2], mat: MAT.woodTrim });
    }

    // ── VARIANT-AGNOSTIC DECOR ─────────────────────────────────────────────────

    // Eave fascia strips along top of outer walls (4 sides)
    const eaveW = W + 0.1;
    const eaveD = D + 0.1;
    decor.push({ s: [eaveW, 0.18, 0.12], p: [0, wallTop, halfD], mat: MAT.woodTrim });  // front
    decor.push({ s: [eaveW, 0.18, 0.12], p: [0, wallTop, -halfD], mat: MAT.woodTrim }); // back
    decor.push({ s: [0.12, 0.18, eaveD], p: [-halfW, wallTop, 0], mat: MAT.woodTrim }); // left
    decor.push({ s: [0.12, 0.18, eaveD], p: [halfW, wallTop, 0], mat: MAT.woodTrim });  // right

    // Corner quoins — 4 vertical strips
    const qW = variant === 2 ? 0.22 : 0.18;
    const qH = variant === 2 ? H * 0.95 : H * 0.85;
    const qY = floorY + qH / 2;
    const qOff = 0.04;
    decor.push({ s: [qW, qH, qW], p: [-(halfW + qOff), qY, -(halfD + qOff)], mat: MAT.stoneBase });
    decor.push({ s: [qW, qH, qW], p: [+(halfW + qOff), qY, -(halfD + qOff)], mat: MAT.stoneBase });
    decor.push({ s: [qW, qH, qW], p: [-(halfW + qOff), qY, +(halfD + qOff)], mat: MAT.stoneBase });
    decor.push({ s: [qW, qH, qW], p: [+(halfW + qOff), qY, +(halfD + qOff)], mat: MAT.stoneBase });

    // ── PER-VARIANT DECOR ─────────────────────────────────────────────────────

    if (variant === 0) {
      // Porch awning over front door (left side, x=-3)
      const awningY = floorY + DOOR_H + 0.3;
      decor.push({ s: [DOOR_W + 0.8, 0.12, 1.0], p: [-3.0, awningY, halfD + 0.3], mat: MAT.woodTrim });
      const postHeight = DOOR_H + 0.3;
      const pY = floorY + postHeight / 2;
      decor.push({ s: [0.12, postHeight, 0.12], p: [-(3.0 + DOOR_W / 2 + 0.3), pY, halfD + 0.85], mat: MAT.woodTrim });
      decor.push({ s: [0.12, postHeight, 0.12], p: [-(3.0 - DOOR_W / 2 - 0.3), pY, halfD + 0.85], mat: MAT.woodTrim });
    }

    if (variant === 2) {
      // Foundation course — stone band around base
      decor.push({ s: [W + 0.5, 0.3, D + 0.5], p: [0, PLINTH_H + 0.15, 0], mat: MAT.stoneBase });
    }

    if (variant === 3) {
      // Recessed shadow-line panel strips on all 4 wall faces
      const panelH = H * 0.7;
      const panelY = floorY + H / 2;
      for (const zc of [halfD, -halfD]) {
        for (let frac = 1; frac <= 5; frac++) {
          const px = -halfW + (W * frac) / 6;
          decor.push({ s: [0.08, panelH, WALL_T + 0.06], p: [px, panelY, zc], mat: MAT.woodTrim });
        }
      }
      for (const xc of [halfW, -halfW]) {
        for (let frac = 1; frac <= 3; frac++) {
          const pz = -halfD + (D * frac) / 4;
          decor.push({ s: [WALL_T + 0.06, panelH, 0.08], p: [xc, panelY, pz], mat: MAT.woodTrim });
        }
      }
    }

    return { walls, decor, windows };
  }, [wallMat, variant, headerH]);

  // ── merge all box-based segments by material into one mesh each ──────────────
  const mergedMeshes = useMemo<MergedMesh[]>(() => {
    const allSegs = [...walls, ...decor];
    const groups = new Map<THREE.Material, THREE.BufferGeometry[]>();

    for (const seg of allSegs) {
      const geo = new THREE.BoxGeometry(...seg.s);
      geo.applyMatrix4(new THREE.Matrix4().makeTranslation(seg.p[0], seg.p[1], seg.p[2]));
      const existing = groups.get(seg.mat);
      if (existing) {
        existing.push(geo);
      } else {
        groups.set(seg.mat, [geo]);
      }
    }

    const result: MergedMesh[] = [];
    for (const [mat, geos] of groups) {
      const merged = mergeGeometries(geos, false);
      if (merged) result.push({ geo: merged, mat });
      for (const g of geos) g.dispose();
    }
    return result;
  }, [walls, decor]);

  // Dispose merged geometries on unmount / dependency change
  useEffect(() => () => { mergedMeshes.forEach(m => m.geo.dispose()); }, [mergedMeshes]);

  return (
    <group position={position} rotation={[0, rotationY, 0]}>
      {/* plinth */}
      <mesh position={[0, PLINTH_H / 2, 0]} material={MAT.stoneBase} castShadow receiveShadow>
        <boxGeometry args={[W + 0.4, PLINTH_H, D + 0.4]} />
      </mesh>

      {/* merged wall + floor + decor geometry (one draw call per material) */}
      {mergedMeshes.map((m, i) => (
        <mesh key={i} geometry={m.geo} material={m.mat} castShadow receiveShadow />
      ))}

      {/* breakable glass windows — kept separate, manage their own state */}
      {windows.map((w, i) => (
        <BreakableWindow key={`w${i}`} position={w.pos} width={WW} height={WH} facing={w.facing} />
      ))}

      {/* colliders: wall/floor/stair/parapet segments + plinth */}
      <RigidBody type="fixed" colliders={false}>
        {/* plinth */}
        <CuboidCollider args={[(W + 0.4) / 2, PLINTH_H / 2, (D + 0.4) / 2]} position={[0, PLINTH_H / 2, 0]} />
        {/* all walls (outer, interior, stairs, roof, parapets, balcony slab) */}
        {walls.map((g, i) => (
          <CuboidCollider key={i} args={[g.s[0] / 2, g.s[1] / 2, g.s[2] / 2]} position={g.p} />
        ))}
      </RigidBody>
    </group>
  );
}
