"use client";

import { useEffect, useMemo } from "react";
import * as THREE from "three";
import { RigidBody, CuboidCollider } from "@react-three/rapier";
import { mergeGeometries } from "three/examples/jsm/utils/BufferGeometryUtils.js";
import { MAT } from "@/game/levels/materials";
import { BreakableWindow } from "@/game/levels/BreakableWindow";
import { Door } from "@/game/levels/Door";

export interface OpenRoofTowerProps {
  position: [number, number, number];
  rotationY?: number;
  variant?: 0 | 1 | 2 | 3;
  alt?: boolean;
}

// ── Dimensions ───────────────────────────────────────────────────────────────
const W = 9;
const D = 9;
const STOREY_H = 2.8;
const WALL_T = 0.3;
const PLINTH_H = 0.4;
const FLOOR_T = 0.2;

const halfW = W / 2;       // 4.5
const halfD = D / 2;       // 4.5
const H = 3 * STOREY_H;   // 8.4  (full wall height)
const floorY = PLINTH_H;   // 0.4

// Wall face centres (inner face for openings, outer face ≈ ±halfW/D)
const zb = halfD - WALL_T / 2; // 4.35  (front/back wall Z)
const xb = halfW - WALL_T / 2; // 4.35  (left/right wall X)

// Interior spans
const innerW = W - 2 * WALL_T; // 8.4
const innerD = D - 2 * WALL_T; // 8.4

// Window dimensions
const WW = 1.4;
const WH = 1.2;
const SILL = 0.9;

// Door dimensions (ground floor front)
const DOOR_W = 1.2;
const DOOR_H = 2.2;

// ── Stair layout ─────────────────────────────────────────────────────────────
const SW = 1.8;                          // stair corridor width
const N_STEPS = 13;
const stepH = STOREY_H / N_STEPS;       // ≈0.215  (well under 0.5 autostep)
const x_inner_left = -halfW + WALL_T;   // -4.2
const z_back_inner = -halfD + WALL_T;   // -4.2
const STAIR_RUN = innerD * 0.7;         // 5.88
const tread = STAIR_RUN / N_STEPS;      // ≈0.452

// Flight X-centres (slightly offset between flights so it feels like a turn)
const FLT1_X = x_inner_left + SW / 2;  // -3.3
const FLT2_X = FLT1_X + 0.3;           // -3.0
const FLT3_X = FLT1_X;                 // -3.3 (back to original side)

// Flight 1 Z: starts at z_back_inner, runs +Z
const FLT1_Z_START = z_back_inner;
// Flight 2 Z: starts where flight 1 ends (+ a tiny landing), runs -Z
const FLT2_Z_START = FLT1_Z_START + STAIR_RUN;
// Flight 3 Z: starts back at z_back_inner again, runs +Z
const FLT3_Z_START = z_back_inner;

// Stair hole occupies: x: [HOLE_X0, HOLE_X1], z: [z_back_inner, z_back_inner + STAIR_RUN]
// HOLE_X1 is widened by 0.3 beyond SW to cover flight 2's X-offset (+0.3) so its
// right edge (FLT2_X + SW*0.9/2 = -3.0+0.81 = -2.19) stays under the open hole. ✓
const HOLE_X0 = x_inner_left;
const HOLE_X1 = x_inner_left + SW + 0.3;  // -2.1 instead of -2.4 — eliminates 0.21m underlap on flight 2
const HOLE_Z1 = z_back_inner + STAIR_RUN;

// ── Shared types ──────────────────────────────────────────────────────────────
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

// ─────────────────────────────────────────────────────────────────────────────
export function OpenRoofTower({
  position,
  rotationY = 0,
  variant = 0,
  alt: _alt = false,
}: OpenRoofTowerProps) {
  // _alt reserved for future tint variation — MAT.concrete is used for both

  const { walls, decor, windows } = useMemo(() => {
    const walls: Seg[] = [];
    const decor: Seg[] = [];
    const windows: Win[] = [];

    // ── Helper: window in a Z-facing wall (runs along X) ──────────────────
    const addWindowZ = (zc: number, base: number) => {
      // sill strip
      walls.push({ s: [W, SILL, WALL_T], p: [0, base + SILL / 2, zc], mat: MAT.concrete });
      // header strip
      const headerH = STOREY_H - SILL - WH;
      walls.push({ s: [W, headerH, WALL_T], p: [0, base + SILL + WH + headerH / 2, zc], mat: MAT.concrete });
      // left pillar
      const pillarW = (W - WW) / 2;
      walls.push({ s: [pillarW, WH, WALL_T], p: [-(halfW - pillarW / 2), base + SILL + WH / 2, zc], mat: MAT.concrete });
      // right pillar
      walls.push({ s: [pillarW, WH, WALL_T], p: [+(halfW - pillarW / 2), base + SILL + WH / 2, zc], mat: MAT.concrete });
      // sill ledge (visual protrusion)
      decor.push({ s: [WW + 0.2, 0.1, WALL_T + 0.08], p: [0, base + SILL, zc], mat: MAT.woodTrim });
      // breakable glass marker
      windows.push({ pos: [0, base + SILL + WH / 2, zc], facing: "z" });
    };

    // ── Helper: window in an X-facing wall (runs along Z) ─────────────────
    const addWindowX = (xc: number, base: number) => {
      const headerH = STOREY_H - SILL - WH;
      const pillarD = (D - WW) / 2;
      // sill strip
      walls.push({ s: [WALL_T, SILL, D], p: [xc, base + SILL / 2, 0], mat: MAT.concrete });
      // header strip
      walls.push({ s: [WALL_T, headerH, D], p: [xc, base + SILL + WH + headerH / 2, 0], mat: MAT.concrete });
      // near pillar
      walls.push({ s: [WALL_T, WH, pillarD], p: [xc, base + SILL + WH / 2, -(halfD - pillarD / 2)], mat: MAT.concrete });
      // far pillar
      walls.push({ s: [WALL_T, WH, pillarD], p: [xc, base + SILL + WH / 2, +(halfD - pillarD / 2)], mat: MAT.concrete });
      // sill ledge
      decor.push({ s: [WALL_T + 0.08, 0.1, WW + 0.2], p: [xc, base + SILL, 0], mat: MAT.woodTrim });
      windows.push({ pos: [xc, base + SILL + WH / 2, 0], facing: "x" });
    };

    // ═══════════════════════════════════════════════════════════════════════
    // OUTER WALLS — 3 storeys
    // ═══════════════════════════════════════════════════════════════════════

    for (let s = 0; s < 3; s++) {
      const base = floorY + s * STOREY_H;

      // ── FRONT WALL (z = +zb) ────────────────────────────────────────────
      if (s === 0) {
        // Ground floor: door opening
        const sideW = (W - DOOR_W) / 2;
        walls.push({ s: [sideW, STOREY_H, WALL_T], p: [-(halfW - sideW / 2), base + STOREY_H / 2, zb], mat: MAT.concrete });
        walls.push({ s: [sideW, STOREY_H, WALL_T], p: [+(halfW - sideW / 2), base + STOREY_H / 2, zb], mat: MAT.concrete });
        // header above door
        walls.push({ s: [DOOR_W, STOREY_H - DOOR_H, WALL_T], p: [0, base + DOOR_H + (STOREY_H - DOOR_H) / 2, zb], mat: MAT.concrete });
        // door slab is now an animated <Door> below; only the trim stays baked
        decor.push({ s: [DOOR_W + 0.18, DOOR_H + 0.1, 0.1], p: [0, base + DOOR_H / 2, zb - WALL_T + 0.04], mat: MAT.woodTrim });
      } else {
        // Floors 2 and 3: centred window
        addWindowZ(zb, base);
      }

      // ── BACK WALL (z = -zb) — window every storey ───────────────────────
      addWindowZ(-zb, base);

      // ── LEFT WALL (x = -xb) — ground solid; upper floors have window ────
      if (s === 0) {
        // Ground: solid
        walls.push({ s: [WALL_T, STOREY_H, D], p: [-xb, base + STOREY_H / 2, 0], mat: MAT.concrete });
      } else {
        addWindowX(-xb, base);
      }

      // ── RIGHT WALL (x = +xb) — window on all storeys ────────────────────
      addWindowX(xb, base);
    }

    // ═══════════════════════════════════════════════════════════════════════
    // INTERMEDIATE FLOOR SLABS (between storeys)
    // Each slab leaves a hole over [HOLE_X0..HOLE_X1] x [HOLE_Z0..HOLE_Z1]
    // Decomposed into 3 rectangles: right strip, front strip (near), back strip (far)
    // ═══════════════════════════════════════════════════════════════════════

    const addFloorSlab = (fy: number) => {
      // Right section: from HOLE_X1 to +halfW inner
      const rightW = innerW - SW; // 8.4 - 1.8 = 6.6
      const rightCX = HOLE_X1 + rightW / 2;
      walls.push({ s: [rightW, FLOOR_T, innerD], p: [rightCX, fy, 0], mat: MAT.concrete });

      // Back strip: stair width, from HOLE_Z1 to back of room
      // (z range: [z_back_inner .. HOLE_Z0 .. HOLE_Z1 .. z_front_inner])
      // HOLE_Z0 = z_back_inner, so there is nothing behind hole
      // Front strip: stair width, from HOLE_Z1 to front inner edge
      const frontStripD = innerD - STAIR_RUN; // ≈1.92
      if (frontStripD > 0.01) {
        const frontStripCZ = HOLE_Z1 + frontStripD / 2;
        walls.push({ s: [SW, FLOOR_T, frontStripD], p: [HOLE_X0 + SW / 2, fy, frontStripCZ], mat: MAT.concrete });
      }
    };

    // Floor slab at top of storey 1 (between floor 1 and floor 2)
    addFloorSlab(floorY + STOREY_H);
    // Floor slab at top of storey 2 (between floor 2 and floor 3)
    addFloorSlab(floorY + 2 * STOREY_H);

    // ═══════════════════════════════════════════════════════════════════════
    // STAIRCASES — 3 flights
    // Solid-block rising step pattern (same as House.tsx)
    // Each step i: block height = (i+1)*stepH, position spans one tread
    // Flight 1: +Z direction from z_back_inner
    // Flight 2: -Z direction from FLT2_Z_START (reversal)
    // Flight 3: +Z direction from z_back_inner (same as flight 1)
    // ═══════════════════════════════════════════════════════════════════════

    const addFlight = (
      flightBase: number,   // Y at the bottom of this flight
      xCenter: number,      // X centre of the stair run
      zStart: number,       // Z at the start tread centre
      dirZ: 1 | -1          // +1 = running toward +Z, -1 = toward -Z
    ) => {
      for (let i = 0; i < N_STEPS; i++) {
        const h = (i + 1) * stepH;
        const zCenter = zStart + dirZ * (i + 0.5) * tread;
        walls.push({
          s: [SW * 0.9, h, tread + 0.01],
          p: [xCenter, flightBase + h / 2, zCenter],
          mat: MAT.stoneBase,
        });
      }
    };

    // Flight 1: floor 1 → floor 2  (+Z direction)
    addFlight(floorY, FLT1_X, FLT1_Z_START, +1);
    // Flight 2: floor 2 → floor 3  (-Z direction, starts from far end)
    addFlight(floorY + STOREY_H, FLT2_X, FLT2_Z_START, -1);
    // Flight 3: floor 3 → roof      (+Z direction)
    addFlight(floorY + 2 * STOREY_H, FLT3_X, FLT3_Z_START, +1);

    // ═══════════════════════════════════════════════════════════════════════
    // ROOF SLAB (flat, open — sniper position)
    // Full [W x D] minus stair hole, split into 3 sections
    // ═══════════════════════════════════════════════════════════════════════

    const roofY = floorY + 3 * STOREY_H; // 0.4 + 8.4 = 8.8

    {
      // Section A: right of hole (same as floor slab right strip)
      const rightW = innerW - SW;
      const rightCX = HOLE_X1 + rightW / 2;
      walls.push({ s: [rightW + 2 * WALL_T, FLOOR_T, D], p: [rightCX + WALL_T, roofY, 0], mat: MAT.concrete });

      // Section B: left strip in front of hole (from HOLE_Z1 to +halfD)
      // Width = SW so right edge aligns exactly with HOLE_X1 (-2.4), closing the gap with Section A.
      const frontStripD = halfD - HOLE_Z1;
      if (frontStripD > 0.01) {
        walls.push({ s: [SW, FLOOR_T, frontStripD], p: [HOLE_X0 + SW / 2, roofY, HOLE_Z1 + frontStripD / 2], mat: MAT.concrete });
      }

      // Section C: back wall-thickness strip (WALL_T deep, behind the stair hole)
      // Width = SW so right edge aligns exactly with HOLE_X1 (-2.4).
      walls.push({ s: [SW, FLOOR_T, WALL_T], p: [HOLE_X0 + SW / 2, roofY, -halfD + WALL_T / 2], mat: MAT.concrete });
    }

    // ═══════════════════════════════════════════════════════════════════════
    // PARAPET WALLS (low cover all around the roof edge)
    // Height 1.1, top of parapet = roofY + FLOOR_T/2 + 1.1
    // ═══════════════════════════════════════════════════════════════════════

    const parapetY = roofY + FLOOR_T / 2 + 1.1 / 2; // centre Y of parapet blocks
    const PARAPET_H = 1.1;

    // Front parapet (z = +halfD)
    walls.push({ s: [W, PARAPET_H, WALL_T], p: [0, parapetY, halfD - WALL_T / 2], mat: MAT.concreteDark });
    // Back parapet — split for stair gap (1.8 wide)
    const stairGapW = SW + 0.2; // 2.0
    const backParapetSide = (W - stairGapW) / 2; // 3.5
    walls.push({ s: [backParapetSide, PARAPET_H, WALL_T], p: [-(halfW - backParapetSide / 2), parapetY, -(halfD - WALL_T / 2)], mat: MAT.concreteDark });
    walls.push({ s: [backParapetSide, PARAPET_H, WALL_T], p: [+(halfW - backParapetSide / 2), parapetY, -(halfD - WALL_T / 2)], mat: MAT.concreteDark });
    // Left parapet
    walls.push({ s: [WALL_T, PARAPET_H, D], p: [-(halfW - WALL_T / 2), parapetY, 0], mat: MAT.concreteDark });
    // Right parapet
    walls.push({ s: [WALL_T, PARAPET_H, D], p: [+(halfW - WALL_T / 2), parapetY, 0], mat: MAT.concreteDark });

    // ═══════════════════════════════════════════════════════════════════════
    // VISUAL DECOR
    // ═══════════════════════════════════════════════════════════════════════

    // Corner pilasters — full height concrete strips at all 4 corners
    const pilasterH = H + 0.6;
    const pilasterY = floorY + pilasterH / 2;
    const po = 0.04;
    decor.push({ s: [0.25, pilasterH, 0.25], p: [-(halfW + po), pilasterY, -(halfD + po)], mat: MAT.concrete });
    decor.push({ s: [0.25, pilasterH, 0.25], p: [+(halfW + po), pilasterY, -(halfD + po)], mat: MAT.concrete });
    decor.push({ s: [0.25, pilasterH, 0.25], p: [-(halfW + po), pilasterY, +(halfD + po)], mat: MAT.concrete });
    decor.push({ s: [0.25, pilasterH, 0.25], p: [+(halfW + po), pilasterY, +(halfD + po)], mat: MAT.concrete });

    // Horizontal banding at each storey boundary — 4 strips forming a hollow frame
    for (let s = 0; s <= 3; s++) {
      const bandY = floorY + s * STOREY_H;
      const BW = W + 0.2;
      const BD = D + 0.2;
      const BH = 0.2;
      // front
      decor.push({ s: [BW, BH, WALL_T + 0.04], p: [0, bandY, halfD], mat: MAT.concreteDark });
      // back
      decor.push({ s: [BW, BH, WALL_T + 0.04], p: [0, bandY, -halfD], mat: MAT.concreteDark });
      // left (bridge front/back without double-counting corners)
      decor.push({ s: [WALL_T + 0.04, BH, BD - 2 * (WALL_T + 0.04)], p: [-halfW, bandY, 0], mat: MAT.concreteDark });
      // right
      decor.push({ s: [WALL_T + 0.04, BH, BD - 2 * (WALL_T + 0.04)], p: [+halfW, bandY, 0], mat: MAT.concreteDark });
    }

    // ── Variant-specific roof details ────────────────────────────────────────

    if (variant === 0) {
      // Antenna mast at centre-back of roof
      const mastY = roofY + FLOOR_T / 2 + 2.5 / 2;
      decor.push({ s: [0.15, 2.5, 0.15], p: [0, mastY, -halfD * 0.6], mat: MAT.trim });
      // cross-arms
      decor.push({ s: [0.8, 0.08, 0.08], p: [0, roofY + FLOOR_T / 2 + 2.2, -halfD * 0.6], mat: MAT.trim });
      decor.push({ s: [0.5, 0.08, 0.08], p: [0, roofY + FLOOR_T / 2 + 1.8, -halfD * 0.6], mat: MAT.trim });
    }

    if (variant === 1) {
      // Satellite dish approximation — flat box tilted
      // (tilted elements can't go in the merge pipeline, handled separately)
      // We approximate with stacked boxes: base post + flat dish
      const dishY = roofY + FLOOR_T / 2 + 0.5;
      decor.push({ s: [0.12, 0.5, 0.12], p: [halfW * 0.6, roofY + FLOOR_T / 2 + 0.25, -halfD * 0.5], mat: MAT.trim });
      decor.push({ s: [0.6, 0.08, 0.5], p: [halfW * 0.6, dishY, -halfD * 0.5], mat: MAT.concrete });
    }

    if (variant === 2) {
      // Water tank on roof — box with 4 legs
      const tankBaseY = roofY + FLOOR_T / 2;
      const tankH = 1.2;
      const legH = 0.6;
      decor.push({ s: [1.0, tankH, 1.0], p: [halfW * 0.5, tankBaseY + legH + tankH / 2, halfD * 0.4], mat: MAT.ductMetal });
      // 4 legs
      for (const [lx, lz] of [[-0.38, -0.38], [0.38, -0.38], [-0.38, 0.38], [0.38, 0.38]] as [number, number][]) {
        decor.push({ s: [0.1, legH, 0.1], p: [halfW * 0.5 + lx, tankBaseY + legH / 2, halfD * 0.4 + lz], mat: MAT.trim });
      }
    }

    if (variant === 3) {
      // Sandbag approximation — low fat boxes around roof edges as extra cover
      // Front edge: row of 4 sandbags inside parapet
      const sandbagY = roofY + FLOOR_T / 2 + 0.2 / 2;
      const sandbagZ_front = halfD - WALL_T - 0.25;
      for (let i = -1; i <= 2; i++) {
        decor.push({ s: [1.1, 0.2, 0.35], p: [i * 1.2 - 0.5, sandbagY, sandbagZ_front], mat: MAT.barrier });
      }
      // Back edge (split around stair gap)
      const sandbagZ_back = -(halfD - WALL_T - 0.25);
      decor.push({ s: [2.8, 0.2, 0.35], p: [-2.5, sandbagY, sandbagZ_back], mat: MAT.barrier });
      decor.push({ s: [2.8, 0.2, 0.35], p: [2.5, sandbagY, sandbagZ_back], mat: MAT.barrier });
    }

    return { walls, decor, windows };
  }, [variant]);

  // ── Merge all box segments by material → one draw call per material ────────
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
      if (merged) {
        result.push({ geo: merged, mat });
      }
      for (const g of geos) g.dispose();
    }
    return result;
  }, [walls, decor]);

  // Dispose merged geometries on unmount / dependency change
  useEffect(() => () => { mergedMeshes.forEach((m) => m.geo.dispose()); }, [mergedMeshes]);

  return (
    <group position={position} rotation={[0, rotationY, 0]}>
      {/* ── Plinth ── */}
      <mesh position={[0, PLINTH_H / 2, 0]} material={MAT.stoneBase} castShadow receiveShadow>
        <boxGeometry args={[W + 0.5, PLINTH_H, D + 0.5]} />
      </mesh>

      {/* ── Merged walls + floors + decor (one draw call per material) ── */}
      {mergedMeshes.map((m, i) => (
        <mesh key={i} geometry={m.geo} material={m.mat} castShadow receiveShadow />
      ))}

      {/* front door — auto-swings open as players approach */}
      <Door
        center={[0, floorY + DOOR_H / 2, zb]}
        width={DOOR_W}
        height={DOOR_H}
        facing={1}
        material={MAT.doorWood}
      />

      {/* ── Breakable glass windows ── */}
      {windows.map((w, i) => (
        <BreakableWindow key={`w${i}`} position={w.pos} width={WW} height={WH} facing={w.facing} />
      ))}

      {/* ── Physics colliders ── */}
      <RigidBody type="fixed" colliders={false}>
        {/* Plinth */}
        <CuboidCollider args={[(W + 0.5) / 2, PLINTH_H / 2, (D + 0.5) / 2]} position={[0, PLINTH_H / 2, 0]} />

        {/* All wall segments, floor slabs, stair steps, and parapets */}
        {walls.map((g, i) => (
          <CuboidCollider key={i} args={[g.s[0] / 2, g.s[1] / 2, g.s[2] / 2]} position={g.p} />
        ))}
      </RigidBody>
    </group>
  );
}
