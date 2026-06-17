"use client";

/**
 * Furniture.tsx — procedural interior furniture for the FPS town.
 *
 * Strategy: one <Instances> (InstancedMesh, drei) per distinct box/cylinder
 * primitive across ALL buildings, computed once in useMemo.  Colliders only
 * for large cover pieces (bed, table-top, sofa, shelf).
 *
 * Building footprints (LOCAL coords, door faces +Z):
 *   House kind=0 : W=9 D=6  floorY=0.35
 *   House kind=1 : W=8 D=7  floorY=0.35
 *   SquadHouse   : W=12 D=10 floorY=0.35
 *   OpenRoofTower: W=9  D=9  floorY=0.40
 * Wall thickness ≈0.25–0.30 → inset 0.8m from wall face is safe.
 */

import { useMemo } from "react";
import { Instances, Instance } from "@react-three/drei";
import { RigidBody, CuboidCollider } from "@react-three/rapier";
import * as THREE from "three";
import { PLOTS } from "@/game/levels/layout";
import { MAT } from "@/game/levels/materials";

// ─────────────────────────────────────────────────────────────────────────────
// Furniture-only materials (kept alongside MAT to avoid new files)
// ─────────────────────────────────────────────────────────────────────────────

const MAT_FABRIC = new THREE.MeshStandardMaterial({ color: "#5a7a6a", roughness: 0.9, metalness: 0.0 });
const MAT_MATTRESS = new THREE.MeshStandardMaterial({ color: "#d6c9a8", roughness: 0.95, metalness: 0.0 });
const MAT_RUG = new THREE.MeshStandardMaterial({ color: "#7a4a2a", roughness: 1.0, metalness: 0.0 });
const MAT_LAMP_SHADE = new THREE.MeshStandardMaterial({
  color: "#e8d8a0",
  roughness: 0.7,
  metalness: 0.0,
  emissive: "#a07030",
  emissiveIntensity: 0.4,
});
const MAT_LAMP_POLE = new THREE.MeshStandardMaterial({ color: "#2a2a2a", roughness: 0.4, metalness: 0.7 });

// ─────────────────────────────────────────────────────────────────────────────
// Geometry helpers
// ─────────────────────────────────────────────────────────────────────────────

/** Apply a world transform (rotate by yaw around Y, then translate) to a local position. */
function worldPos(
  lx: number,
  ly: number,
  lz: number,
  plotX: number,
  plotZ: number,
  yaw: number,
): [number, number, number] {
  const cos = Math.cos(yaw);
  const sin = Math.sin(yaw);
  return [
    plotX + cos * lx - sin * lz,
    ly,
    plotZ + sin * lx + cos * lz,
  ];
}

/** Deterministic hash → 0..1 */
function fhash(a: number, b: number, c: number): number {
  const x = Math.sin(a * 127.1 + b * 311.7 + c * 74.13) * 43758.5453;
  return x - Math.floor(x);
}

// ─────────────────────────────────────────────────────────────────────────────
// Transform records
// ─────────────────────────────────────────────────────────────────────────────

interface BoxXfm {
  pos: [number, number, number];
  yaw: number; // world-space yaw of this instance (plot.yaw + local piece yaw)
}
interface CylXfm {
  pos: [number, number, number];
}
interface ColliderXfm {
  pos: [number, number, number];
  half: [number, number, number];
}

interface AllInstances {
  // bed frame box (1.0 × 0.4 × 2.0)
  bedFrame: BoxXfm[];
  // mattress (0.95 × 0.15 × 1.9)
  mattress: BoxXfm[];
  // pillow (0.45 × 0.12 × 0.3)
  pillow: BoxXfm[];

  // table top (1.2 × 0.06 × 0.7)
  tableTop: BoxXfm[];
  // table leg cylinder r=0.04 h=0.72
  tableLeg: CylXfm[];

  // chair seat (0.45 × 0.06 × 0.45)
  chairSeat: BoxXfm[];
  // chair back (0.45 × 0.45 × 0.06)
  chairBack: BoxXfm[];
  // chair leg r=0.025 h=0.42
  chairLeg: CylXfm[];

  // sofa body (1.6 × 0.45 × 0.7)
  sofaBody: BoxXfm[];
  // sofa back (1.6 × 0.3 × 0.15)
  sofaBack: BoxXfm[];
  // sofa arm (0.15 × 0.3 × 0.7)
  sofaArm: BoxXfm[];

  // shelf body (0.9 × 1.2 × 0.3)
  shelfBody: BoxXfm[];

  // rug (flat box 2.0 × 0.02 × 1.2)
  rug: BoxXfm[];

  // small crate / side-table (0.45 × 0.45 × 0.45)
  sideCrate: BoxXfm[];

  // lamp pole cylinder r=0.03 h=1.4
  lampPole: CylXfm[];
  // lamp shade cone approx (cylinder tapered) r=0.28 h=0.22
  lampShade: CylXfm[];

  // colliders for cover pieces
  bedColliders: ColliderXfm[];
  tableColliders: ColliderXfm[];
  sofaColliders: ColliderXfm[];
  shelfColliders: ColliderXfm[];
}

// ─────────────────────────────────────────────────────────────────────────────
// Per-building furniture placement — local coords, then world-transform
// ─────────────────────────────────────────────────────────────────────────────

const FLOOR = 0.35; // floorY for house/squad (tower uses 0.40 but diff is tiny)
const FLOOR_TOWER = 0.40;
const INSET = 0.8;  // minimum inset from wall face centre

/**
 * Pushes instance transforms for ONE building into the accumulator arrays.
 * All coordinates in WORLD space are computed here.
 */
function placeFurniture(
  acc: AllInstances,
  plotX: number,
  plotZ: number,
  yaw: number,
  kind: 0 | 1 | 2 | 3 | 4,
  variant: 0 | 1 | 2 | 3,
): void {
  if (kind === 2) return; // warehouses skipped

  // Building interior half-extents (inner clear space from centre to inner wall face)
  // We subtract INSET so pieces stay away from walls.
  let hw: number; // usable half-width  (along local X)
  let hd: number; // usable half-depth  (along local Z)
  let fy: number; // floor Y

  if (kind === 3) {
    hw = 12 / 2 - INSET; // 5.2
    hd = 10 / 2 - INSET; // 4.2
    fy = FLOOR;
  } else if (kind === 4) {
    hw = 9 / 2 - INSET; // 3.7
    hd = 9 / 2 - INSET; // 3.7
    fy = FLOOR_TOWER;
  } else if (kind === 1) {
    hw = 8 / 2 - INSET; // 3.2
    hd = 7 / 2 - INSET; // 2.7
    fy = FLOOR;
  } else {
    // kind === 0
    hw = 9 / 2 - INSET; // 3.7
    hd = 6 / 2 - INSET; // 2.2
    fy = FLOOR;
  }

  /** Push a box instance (world) */
  const box = (arr: BoxXfm[], lx: number, lz: number, ly: number, pieceYaw = 0) => {
    arr.push({
      pos: worldPos(lx, ly, lz, plotX, plotZ, yaw),
      yaw: yaw + pieceYaw,
    });
  };

  /** Push a cylinder instance (world) — yaw doesn't matter for upright cylinders */
  const cyl = (arr: CylXfm[], lx: number, lz: number, ly: number) => {
    arr.push({ pos: worldPos(lx, ly, lz, plotX, plotZ, yaw) });
  };

  /** Push a cover collider */
  const col = (arr: ColliderXfm[], lx: number, lz: number, ly: number, hx: number, hy: number, hz: number) => {
    arr.push({ pos: worldPos(lx, ly, lz, plotX, plotZ, yaw), half: [hx, hy, hz] });
  };

  // A tiny deterministic jitter to stop every building being pixel-identical
  const jx = (fhash(plotX, plotZ, 0) - 0.5) * 0.3;
  const jz = (fhash(plotX, plotZ, 1) - 0.5) * 0.3;

  // ── VARIANT 0: bedroom corner + small table ──────────────────────────────
  if (variant === 0) {
    // Bed against back wall (local -Z)
    const bedX = hw * 0.3 + jx;
    const bedZ = -(hd - 0.1); // near back wall
    const bedFY = fy + 0.2; // frame centre Y
    box(acc.bedFrame, bedX, bedZ, bedFY);
    box(acc.mattress, bedX, bedZ, bedFY + 0.28);
    box(acc.pillow,   bedX - 0.22, bedZ - 0.75, bedFY + 0.41);
    col(acc.bedColliders, bedX, bedZ, bedFY + 0.2, 0.5, 0.32, 1.0);

    // Table in the opposite corner (local +X, front area)
    const tX = hw * 0.7 + jx;
    const tZ = hd * 0.45 + jz;
    const tableTopY = fy + 0.72 + 0.03;
    box(acc.tableTop, tX, tZ, tableTopY);
    col(acc.tableColliders, tX, tZ, tableTopY, 0.6, 0.04, 0.35);
    for (const [lx, lz2] of [[-0.5, -0.3], [0.5, -0.3], [-0.5, 0.3], [0.5, 0.3]] as [number, number][]) {
      cyl(acc.tableLeg, tX + lx * 0.9, tZ + lz2 * 0.8, fy + 0.36);
    }

    // Chair at table
    const chX = tX - 0.9;
    const chZ = tZ;
    box(acc.chairSeat, chX, chZ, fy + 0.42 + 0.03);
    box(acc.chairBack, chX, chZ - 0.2, fy + 0.42 + 0.28);
    for (const [lx, lz2] of [[-0.18, -0.18], [0.18, -0.18], [-0.18, 0.18], [0.18, 0.18]] as [number, number][]) {
      cyl(acc.chairLeg, chX + lx, chZ + lz2, fy + 0.21);
    }

    // Rug in centre
    box(acc.rug, jx, jz, fy + 0.01);

    // Lamp pole in back corner
    const lpX = -(hw * 0.7);
    const lpZ = -(hd * 0.7);
    cyl(acc.lampPole, lpX, lpZ, fy + 0.7);
    cyl(acc.lampShade, lpX, lpZ, fy + 1.41);
  }

  // ── VARIANT 1: lounge — sofa + shelf ────────────────────────────────────
  if (variant === 1) {
    // Sofa against back wall, centred
    const sfX = jx;
    const sfZ = -(hd - 0.05);
    const sfFY = fy + 0.225; // sofa seat centre
    box(acc.sofaBody, sfX, sfZ, sfFY);
    box(acc.sofaBack, sfX, sfZ - 0.28, sfFY + 0.375);
    box(acc.sofaArm,  sfX - 0.88, sfZ, sfFY + 0.15);
    box(acc.sofaArm,  sfX + 0.88, sfZ, sfFY + 0.15);
    col(acc.sofaColliders, sfX, sfZ - 0.14, sfFY + 0.15, 0.8, 0.375, 0.425);

    // Shelf: place on right wall for stair buildings (kind 1/3/4) to keep the
    // left (stair) bay clear; left wall is fine for the single-storey house.
    const hasStairs = kind === 1 || kind === 3 || kind === 4;
    const shX = hasStairs ? +(hw - 0.05) : -(hw - 0.05);
    const shZ = jz;
    box(acc.shelfBody, shX, shZ, fy + 0.6);
    col(acc.shelfColliders, shX, shZ, fy + 0.6, 0.15, 0.6, 0.45);

    // Side crate in front corner
    box(acc.sideCrate, hw * 0.6 + jx, hd * 0.5 + jz, fy + 0.225);

    // Rug
    box(acc.rug, jx * 0.5, jz * 0.5, fy + 0.01);

    // Lamp by sofa
    cyl(acc.lampPole, sfX - 1.1, sfZ - 0.3, fy + 0.7);
    cyl(acc.lampShade, sfX - 1.1, sfZ - 0.3, fy + 1.41);
  }

  // ── VARIANT 2: dining / office — table + chairs both sides ───────────────
  if (variant === 2) {
    // Table centred slightly toward back
    const tX = jx;
    const tZ = -(hd * 0.2) + jz;
    const tableTopY = fy + 0.72 + 0.03;
    box(acc.tableTop, tX, tZ, tableTopY);
    col(acc.tableColliders, tX, tZ, tableTopY, 0.6, 0.04, 0.35);
    for (const [lx, lz2] of [[-0.5, -0.3], [0.5, -0.3], [-0.5, 0.3], [0.5, 0.3]] as [number, number][]) {
      cyl(acc.tableLeg, tX + lx * 0.9, tZ + lz2 * 0.8, fy + 0.36);
    }

    // Two chairs, front and back of table
    for (const [side, pYaw] of [[1, 0], [-1, Math.PI]] as [number, number][]) {
      const chX = tX;
      const chZ = tZ + side * 0.85;
      box(acc.chairSeat, chX, chZ, fy + 0.42 + 0.03, pYaw);
      box(acc.chairBack, chX, chZ + side * 0.2, fy + 0.42 + 0.28, pYaw);
      for (const [lx, lz3] of [[-0.18, -0.18], [0.18, -0.18], [-0.18, 0.18], [0.18, 0.18]] as [number, number][]) {
        cyl(acc.chairLeg, chX + lx, chZ + lz3, fy + 0.21);
      }
    }

    // Shelf against right wall
    const shX = hw - 0.05;
    const shZ = -(hd * 0.5) + jz;
    box(acc.shelfBody, shX, shZ, fy + 0.6);
    col(acc.shelfColliders, shX, shZ, fy + 0.6, 0.15, 0.6, 0.45);

    // Rug under table
    box(acc.rug, tX, tZ, fy + 0.01);

    // Side crate
    box(acc.sideCrate, -(hw * 0.6) + jx, hd * 0.6 + jz, fy + 0.225);
  }

  // ── VARIANT 3: multi-room feel — bed + sofa + lamp ───────────────────────
  if (variant === 3) {
    // Bed: place against right wall for stair buildings (kind 1/3/4) so the
    // left (stair) bay stays clear; left wall is fine for the single-storey house.
    const hasStairs = kind === 1 || kind === 3 || kind === 4;
    const bedX = (hasStairs ? +(hw * 0.5) : -(hw * 0.5)) + jx;
    const bedZ = -(hd * 0.5) + jz;
    const bedFY = fy + 0.2;
    // Rotated 90°: bed length runs along local X. Flip pillow headboard offset
    // to match whichever end is now against the wall.
    const pillowEndX = hasStairs ? -0.75 : +0.75;
    box(acc.bedFrame, bedX, bedZ, bedFY, Math.PI / 2);
    box(acc.mattress, bedX, bedZ, bedFY + 0.28, Math.PI / 2);
    box(acc.pillow,   bedX + pillowEndX, bedZ - 0.22, bedFY + 0.41, Math.PI / 2);
    col(acc.bedColliders, bedX, bedZ, bedFY + 0.2, 1.0, 0.32, 0.5);

    // Sofa facing front (toward +Z door)
    const sfX = jx;
    const sfZ = hd * 0.25 + jz;
    const sfFY = fy + 0.225;
    box(acc.sofaBody, sfX, sfZ, sfFY, Math.PI);
    box(acc.sofaBack, sfX, sfZ + 0.28, sfFY + 0.375, Math.PI);
    box(acc.sofaArm,  sfX - 0.88, sfZ, sfFY + 0.15, Math.PI);
    box(acc.sofaArm,  sfX + 0.88, sfZ, sfFY + 0.15, Math.PI);
    col(acc.sofaColliders, sfX, sfZ + 0.14, sfFY + 0.15, 0.8, 0.375, 0.425);

    // Shelf opposite bed
    const shX = hw - 0.05;
    const shZ = -(hd * 0.5) + jz;
    box(acc.shelfBody, shX, shZ, fy + 0.6);
    col(acc.shelfColliders, shX, shZ, fy + 0.6, 0.15, 0.6, 0.45);

    // Rug
    box(acc.rug, sfX, sfZ - 0.5, fy + 0.01, Math.PI);

    // Lamp
    cyl(acc.lampPole, hw * 0.7, -(hd * 0.7), fy + 0.7);
    cyl(acc.lampShade, hw * 0.7, -(hd * 0.7), fy + 1.41);
  }

  // ── Extra pieces for squad house (kind=3): more scatter ─────────────────
  if (kind === 3) {
    // Extra table in the right bay (local +X area)
    const tX2 = hw * 0.5 + jx;
    const tZ2 = -(hd * 0.3) + jz;
    const tY2 = fy + 0.72 + 0.03;
    box(acc.tableTop, tX2, tZ2, tY2);
    col(acc.tableColliders, tX2, tZ2, tY2, 0.6, 0.04, 0.35);
    for (const [lx, lz2] of [[-0.5, -0.3], [0.5, -0.3], [-0.5, 0.3], [0.5, 0.3]] as [number, number][]) {
      cyl(acc.tableLeg, tX2 + lx * 0.9, tZ2 + lz2 * 0.8, fy + 0.36);
    }
    // Extra side crate
    box(acc.sideCrate, -(hw * 0.7) + jx, hd * 0.6 + jz, fy + 0.225);
    // Extra lamp
    cyl(acc.lampPole, hw * 0.8, hd * 0.7, fy + 0.7);
    cyl(acc.lampShade, hw * 0.8, hd * 0.7, fy + 1.41);
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// Main component
// ─────────────────────────────────────────────────────────────────────────────

export function Furniture() {
  const inst = useMemo<AllInstances>(() => {
    const acc: AllInstances = {
      bedFrame: [], mattress: [], pillow: [],
      tableTop: [], tableLeg: [],
      chairSeat: [], chairBack: [], chairLeg: [],
      sofaBody: [], sofaBack: [], sofaArm: [],
      shelfBody: [],
      rug: [],
      sideCrate: [],
      lampPole: [], lampShade: [],
      bedColliders: [], tableColliders: [], sofaColliders: [], shelfColliders: [],
    };

    for (const plot of PLOTS) {
      placeFurniture(acc, plot.x, plot.z, plot.yaw, plot.kind, plot.variant);
    }

    return acc;
  }, []);

  // Convenience: build euler from a yaw number
  const rot = (yaw: number): [number, number, number] => [0, yaw, 0];

  return (
    <>
      {/* ── BED FRAME ── boxGeometry 1.0 × 0.4 × 2.0 */}
      <Instances limit={inst.bedFrame.length} range={inst.bedFrame.length} castShadow receiveShadow>
        <boxGeometry args={[1.0, 0.4, 2.0]} />
        <primitive object={MAT.doorWood} attach="material" />
        {inst.bedFrame.map((x, i) => (
          <Instance key={i} position={x.pos} rotation={rot(x.yaw)} />
        ))}
      </Instances>

      {/* ── MATTRESS ── 0.95 × 0.15 × 1.9 */}
      <Instances limit={inst.mattress.length} range={inst.mattress.length} castShadow receiveShadow>
        <boxGeometry args={[0.95, 0.15, 1.9]} />
        <primitive object={MAT_MATTRESS} attach="material" />
        {inst.mattress.map((x, i) => (
          <Instance key={i} position={x.pos} rotation={rot(x.yaw)} />
        ))}
      </Instances>

      {/* ── PILLOW ── 0.45 × 0.12 × 0.3 */}
      <Instances limit={inst.pillow.length} range={inst.pillow.length} castShadow receiveShadow>
        <boxGeometry args={[0.45, 0.12, 0.3]} />
        <primitive object={MAT_MATTRESS} attach="material" />
        {inst.pillow.map((x, i) => (
          <Instance key={i} position={x.pos} rotation={rot(x.yaw)} />
        ))}
      </Instances>

      {/* ── TABLE TOP ── 1.2 × 0.06 × 0.7 */}
      <Instances limit={inst.tableTop.length} range={inst.tableTop.length} castShadow receiveShadow>
        <boxGeometry args={[1.2, 0.06, 0.7]} />
        <primitive object={MAT.woodTrim} attach="material" />
        {inst.tableTop.map((x, i) => (
          <Instance key={i} position={x.pos} rotation={rot(x.yaw)} />
        ))}
      </Instances>

      {/* ── TABLE LEG ── cylinder r=0.04 h=0.72 */}
      <Instances limit={inst.tableLeg.length} range={inst.tableLeg.length} castShadow>
        <cylinderGeometry args={[0.04, 0.04, 0.72, 8]} />
        <primitive object={MAT.doorWood} attach="material" />
        {inst.tableLeg.map((x, i) => (
          <Instance key={i} position={x.pos} />
        ))}
      </Instances>

      {/* ── CHAIR SEAT ── 0.45 × 0.06 × 0.45 */}
      <Instances limit={inst.chairSeat.length} range={inst.chairSeat.length} castShadow receiveShadow>
        <boxGeometry args={[0.45, 0.06, 0.45]} />
        <primitive object={MAT.woodTrim} attach="material" />
        {inst.chairSeat.map((x, i) => (
          <Instance key={i} position={x.pos} rotation={rot(x.yaw)} />
        ))}
      </Instances>

      {/* ── CHAIR BACK ── 0.45 × 0.45 × 0.06 */}
      <Instances limit={inst.chairBack.length} range={inst.chairBack.length} castShadow receiveShadow>
        <boxGeometry args={[0.45, 0.45, 0.06]} />
        <primitive object={MAT.woodTrim} attach="material" />
        {inst.chairBack.map((x, i) => (
          <Instance key={i} position={x.pos} rotation={rot(x.yaw)} />
        ))}
      </Instances>

      {/* ── CHAIR LEG ── cylinder r=0.025 h=0.42 */}
      <Instances limit={inst.chairLeg.length} range={inst.chairLeg.length} castShadow>
        <cylinderGeometry args={[0.025, 0.025, 0.42, 6]} />
        <primitive object={MAT.doorWood} attach="material" />
        {inst.chairLeg.map((x, i) => (
          <Instance key={i} position={x.pos} />
        ))}
      </Instances>

      {/* ── SOFA BODY ── 1.6 × 0.45 × 0.7 */}
      <Instances limit={inst.sofaBody.length} range={inst.sofaBody.length} castShadow receiveShadow>
        <boxGeometry args={[1.6, 0.45, 0.7]} />
        <primitive object={MAT_FABRIC} attach="material" />
        {inst.sofaBody.map((x, i) => (
          <Instance key={i} position={x.pos} rotation={rot(x.yaw)} />
        ))}
      </Instances>

      {/* ── SOFA BACK ── 1.6 × 0.3 × 0.15 */}
      <Instances limit={inst.sofaBack.length} range={inst.sofaBack.length} castShadow receiveShadow>
        <boxGeometry args={[1.6, 0.3, 0.15]} />
        <primitive object={MAT_FABRIC} attach="material" />
        {inst.sofaBack.map((x, i) => (
          <Instance key={i} position={x.pos} rotation={rot(x.yaw)} />
        ))}
      </Instances>

      {/* ── SOFA ARM ── 0.15 × 0.3 × 0.7 */}
      <Instances limit={inst.sofaArm.length} range={inst.sofaArm.length} castShadow receiveShadow>
        <boxGeometry args={[0.15, 0.3, 0.7]} />
        <primitive object={MAT_FABRIC} attach="material" />
        {inst.sofaArm.map((x, i) => (
          <Instance key={i} position={x.pos} rotation={rot(x.yaw)} />
        ))}
      </Instances>

      {/* ── SHELF ── 0.9 × 1.2 × 0.3 */}
      <Instances limit={inst.shelfBody.length} range={inst.shelfBody.length} castShadow receiveShadow>
        <boxGeometry args={[0.9, 1.2, 0.3]} />
        <primitive object={MAT.woodTrim} attach="material" />
        {inst.shelfBody.map((x, i) => (
          <Instance key={i} position={x.pos} rotation={rot(x.yaw)} />
        ))}
      </Instances>

      {/* ── RUG ── 2.0 × 0.02 × 1.2 */}
      <Instances limit={inst.rug.length} range={inst.rug.length} receiveShadow>
        <boxGeometry args={[2.0, 0.02, 1.2]} />
        <primitive object={MAT_RUG} attach="material" />
        {inst.rug.map((x, i) => (
          <Instance key={i} position={x.pos} rotation={rot(x.yaw)} />
        ))}
      </Instances>

      {/* ── SIDE CRATE ── 0.45 × 0.45 × 0.45 (reuse MAT.crate colour) */}
      <Instances limit={inst.sideCrate.length} range={inst.sideCrate.length} castShadow receiveShadow>
        <boxGeometry args={[0.45, 0.45, 0.45]} />
        <primitive object={MAT.crate} attach="material" />
        {inst.sideCrate.map((x, i) => (
          <Instance key={i} position={x.pos} rotation={rot(x.yaw)} />
        ))}
      </Instances>

      {/* ── LAMP POLE ── cylinder r=0.03 h=1.4 */}
      <Instances limit={inst.lampPole.length} range={inst.lampPole.length} castShadow>
        <cylinderGeometry args={[0.03, 0.03, 1.4, 6]} />
        <primitive object={MAT_LAMP_POLE} attach="material" />
        {inst.lampPole.map((x, i) => (
          <Instance key={i} position={x.pos} />
        ))}
      </Instances>

      {/* ── LAMP SHADE ── tapered cylinder r_top=0.05 r_bot=0.28 h=0.22 */}
      <Instances limit={inst.lampShade.length} range={inst.lampShade.length} castShadow>
        <cylinderGeometry args={[0.05, 0.28, 0.22, 8]} />
        <primitive object={MAT_LAMP_SHADE} attach="material" />
        {inst.lampShade.map((x, i) => (
          <Instance key={i} position={x.pos} />
        ))}
      </Instances>

      {/* ── COVER COLLIDERS (bed, table, sofa, shelf) ── */}
      <RigidBody type="fixed" colliders={false}>
        {inst.bedColliders.map((c, i) => (
          <CuboidCollider key={`b${i}`} args={c.half} position={c.pos} />
        ))}
        {inst.tableColliders.map((c, i) => (
          <CuboidCollider key={`t${i}`} args={c.half} position={c.pos} />
        ))}
        {inst.sofaColliders.map((c, i) => (
          <CuboidCollider key={`s${i}`} args={c.half} position={c.pos} />
        ))}
        {inst.shelfColliders.map((c, i) => (
          <CuboidCollider key={`sh${i}`} args={c.half} position={c.pos} />
        ))}
      </RigidBody>
    </>
  );
}
