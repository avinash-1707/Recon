"use client";

import { useEffect, useMemo } from "react";
import * as THREE from "three";
import { RigidBody, CuboidCollider } from "@react-three/rapier";
import { mergeGeometries } from "three/examples/jsm/utils/BufferGeometryUtils.js";
import { MAT } from "@/game/levels/materials";
import { BreakableWindow } from "@/game/levels/BreakableWindow";

export interface HouseProps {
  position: [number, number, number];
  rotationY?: number;
  storeys?: 1 | 2;
  width?: number;
  depth?: number;
  alt?: boolean;
  variant?: 0 | 1 | 2 | 3;
}

const STOREY_H = 2.8;
const WALL_T = 0.25;
const PLINTH_H = 0.35;
const DOOR_W = 1.1;
const DOOR_H = 2.1;
const EAVE = 0.45;
const SILL = 1.0; // window sill height above each storey floor
const WW = 1.5;   // window opening width
const WH = 1.3;   // window opening height
const FLOOR_T = 0.2;

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
 * Detailed PUBG-style house: textured plastered walls with real window
 * OPENINGS filled by breakable translucent glass, a front door, a textured
 * gable roof shallow enough to stand on (with slope colliders), a chimney, and
 * - for 2-storey - an upper floor reached by an interior staircase.
 *
 * Variant-driven visual detail (all purely visual, no collider impact):
 *   0 → porch awning over door
 *   1 → flower boxes on lower windows, shutters in doorWood
 *   2 → foundation course band, wider corner quoins
 *   3 → recessed wall panel strips, balcony railing (2-storey)
 */
export function House({
  position,
  rotationY = 0,
  storeys = 1,
  width = 8,
  depth = 7,
  alt = false,
  variant = 0,
}: HouseProps) {
  const W = width;
  const D = depth;
  const H = storeys * STOREY_H;
  const floorY = PLINTH_H;
  const wallTop = floorY + H;
  const halfW = W / 2;
  const halfD = depth / 2;
  const wallMat = alt ? MAT.plasterAlt : MAT.plaster;

  const ridgeRise = Math.min(W, D) * 0.3; // shallow → standable
  const ridgeY = wallTop + ridgeRise;
  const halfDe = halfD + EAVE;
  const slopeLen = Math.hypot(halfDe, ridgeRise);
  const theta = Math.atan2(ridgeRise, halfDe);
  const roofW = W + 2 * EAVE;

  // ---- build wall segments + window openings + decor ----
  const { walls, decor, windows } = useMemo(() => {
    const walls: Seg[] = [];
    const decor: Seg[] = [];
    const windows: Win[] = [];
    const zb = halfD - WALL_T / 2;
    const xb = halfW - WALL_T / 2;
    const headerH = STOREY_H - (SILL + WH);
    const pillarW = (W - WW) / 2;
    const pillarD = (D - WW) / 2;

    // shutter material depends on variant
    const shutterMat: THREE.Material = variant === 1 ? MAT.doorWood : MAT.woodTrim;

    const windowWallX = (zc: number, base: number) => {
      // wall spanning X at z=zc, central window opening
      walls.push({ s: [W, SILL, WALL_T], p: [0, base + SILL / 2, zc], mat: wallMat });
      walls.push({ s: [W, headerH, WALL_T], p: [0, base + SILL + WH + headerH / 2, zc], mat: wallMat });
      walls.push({ s: [pillarW, WH, WALL_T], p: [-(W / 2 - pillarW / 2), base + SILL + WH / 2, zc], mat: wallMat });
      walls.push({ s: [pillarW, WH, WALL_T], p: [W / 2 - pillarW / 2, base + SILL + WH / 2, zc], mat: wallMat });
      // sill ledge
      decor.push({ s: [WW + 0.2, 0.1, WALL_T + 0.08], p: [0, base + SILL, zc], mat: MAT.woodTrim });
      windows.push({ pos: [0, base + SILL + WH / 2, zc], facing: "z" });

      // shutters — thin flat panels flanking the window opening (z-facing)
      const shutterOffX = WW / 2 + 0.1;
      const shutterS: [number, number, number] = [0.15, WH + 0.1, 0.06];
      decor.push({ s: shutterS, p: [-(shutterOffX), base + SILL + WH / 2, zc], mat: shutterMat });
      decor.push({ s: shutterS, p: [+(shutterOffX), base + SILL + WH / 2, zc], mat: shutterMat });

      // variant 1: flower box on lower-storey windows only
      if (variant === 1 && base === floorY) {
        decor.push({ s: [WW * 0.8, 0.2, 0.25], p: [0, base + SILL - 0.1, zc], mat: MAT.stoneBase });
      }
    };

    const windowWallZ = (xc: number, base: number) => {
      walls.push({ s: [WALL_T, SILL, D], p: [xc, base + SILL / 2, 0], mat: wallMat });
      walls.push({ s: [WALL_T, headerH, D], p: [xc, base + SILL + WH + headerH / 2, 0], mat: wallMat });
      walls.push({ s: [WALL_T, WH, pillarD], p: [xc, base + SILL + WH / 2, -(D / 2 - pillarD / 2)], mat: wallMat });
      walls.push({ s: [WALL_T, WH, pillarD], p: [xc, base + SILL + WH / 2, D / 2 - pillarD / 2], mat: wallMat });
      // sill ledge
      decor.push({ s: [WALL_T + 0.08, 0.1, WW + 0.2], p: [xc, base + SILL, 0], mat: MAT.woodTrim });
      windows.push({ pos: [xc, base + SILL + WH / 2, 0], facing: "x" });

      // shutters — x-facing windows
      const shutterOffZ = WW / 2 + 0.1;
      const shutterS: [number, number, number] = [0.06, WH + 0.1, 0.15];
      decor.push({ s: shutterS, p: [xc, base + SILL + WH / 2, -(shutterOffZ)], mat: shutterMat });
      decor.push({ s: shutterS, p: [xc, base + SILL + WH / 2, +(shutterOffZ)], mat: shutterMat });
    };

    for (let s = 0; s < storeys; s++) {
      const base = floorY + s * STOREY_H;
      windowWallX(-zb, base); // back
      windowWallZ(-xb, base); // left
      windowWallZ(xb, base);  // right
      if (s === 0) {
        // front ground: doorway
        const sideW = (W - DOOR_W) / 2;
        walls.push({ s: [sideW, STOREY_H, WALL_T], p: [-(W / 2 - sideW / 2), base + STOREY_H / 2, zb], mat: wallMat });
        walls.push({ s: [sideW, STOREY_H, WALL_T], p: [W / 2 - sideW / 2, base + STOREY_H / 2, zb], mat: wallMat });
        walls.push({ s: [DOOR_W, STOREY_H - DOOR_H, WALL_T], p: [0, base + DOOR_H + (STOREY_H - DOOR_H) / 2, zb], mat: wallMat });
        decor.push({ s: [DOOR_W, DOOR_H, 0.08], p: [0, base + DOOR_H / 2, zb], mat: MAT.doorWood });
        decor.push({ s: [DOOR_W + 0.2, DOOR_H + 0.12, 0.12], p: [0, base + DOOR_H / 2, zb - WALL_T + 0.04], mat: MAT.woodTrim });
      } else {
        windowWallX(zb, base); // front upper window
      }
    }

    // upper floor + interior staircase (2-storey)
    if (storeys === 2) {
      const innerW = W - 2 * WALL_T;
      const innerD = D - 2 * WALL_T;
      const SW = 2.0;       // stair run width (along X, left side)
      const LANDING = 1.0;  // clear floor in front of the stairs on both levels
      const fy = floorY + STOREY_H;
      const x0 = -halfW + WALL_T; // inner left edge
      const z0 = -halfD + WALL_T; // inner back edge
      const hz0 = z0 + LANDING;             // run start
      const hz1 = z0 + innerD - LANDING;    // run end
      const run = hz1 - hz0;

      // upper floor = footprint minus hole over the stair run
      walls.push({ s: [innerW - SW, FLOOR_T, innerD], p: [x0 + SW + (innerW - SW) / 2, fy, 0], mat: MAT.woodTrim });
      walls.push({ s: [SW, FLOOR_T, LANDING], p: [x0 + SW / 2, fy, z0 + LANDING / 2], mat: MAT.woodTrim });
      walls.push({ s: [SW, FLOOR_T, LANDING], p: [x0 + SW / 2, fy, hz1 + LANDING / 2], mat: MAT.woodTrim });

      // solid staircase rising over the run
      const nSteps = 13;
      const stepH = STOREY_H / nSteps; // ~0.22 < 0.5 autostep
      const tread = run / nSteps;
      for (let i = 0; i < nSteps; i++) {
        const h = (i + 1) * stepH;
        walls.push({
          s: [SW * 0.92, h, tread + 0.01],
          p: [x0 + SW / 2, floorY + h / 2, hz0 + (i + 0.5) * tread],
          mat: MAT.stoneBase,
        });
      }
    }

    // ---- variant-agnostic global decor ----

    // Eave fascia strips (front and back, along the roofline)
    const eaveW = W + EAVE * 2 + 0.1;
    decor.push({ s: [eaveW, 0.18, 0.12], p: [0, wallTop, halfD + EAVE], mat: MAT.woodTrim });  // front
    decor.push({ s: [eaveW, 0.18, 0.12], p: [0, wallTop, -(halfD + EAVE)], mat: MAT.woodTrim }); // back

    // Corner quoins — 4 vertical strips at wall corners
    const qW = variant === 2 ? 0.22 : 0.18;
    const qH = variant === 2 ? H * 0.95 : H * 0.85;
    const qY = floorY + qH / 2;
    const qOff = 0.04; // slight protrusion from wall face
    decor.push({ s: [qW, qH, qW], p: [-(halfW + qOff), qY, -(halfD + qOff)], mat: MAT.stoneBase });
    decor.push({ s: [qW, qH, qW], p: [+(halfW + qOff), qY, -(halfD + qOff)], mat: MAT.stoneBase });
    decor.push({ s: [qW, qH, qW], p: [-(halfW + qOff), qY, +(halfD + qOff)], mat: MAT.stoneBase });
    decor.push({ s: [qW, qH, qW], p: [+(halfW + qOff), qY, +(halfD + qOff)], mat: MAT.stoneBase });

    // ---- per-variant decor ----

    if (variant === 0) {
      // Porch awning over front door
      const awningY = floorY + DOOR_H + 0.3;
      decor.push({ s: [DOOR_W + 0.8, 0.12, 1.0], p: [0, awningY, halfD + 0.3], mat: MAT.woodTrim }); // slab
      const postH = DOOR_H + 0.3;
      const postY = floorY + postH / 2;
      decor.push({ s: [0.12, postH, 0.12], p: [-(DOOR_W / 2 + 0.3), postY, halfD + 0.85], mat: MAT.woodTrim }); // left post
      decor.push({ s: [0.12, postH, 0.12], p: [+(DOOR_W / 2 + 0.3), postY, halfD + 0.85], mat: MAT.woodTrim }); // right post
    }

    if (variant === 2) {
      // Foundation course — extra stone band around the bottom
      decor.push({ s: [W + 0.5, 0.3, D + 0.5], p: [0, PLINTH_H + 0.15, 0], mat: MAT.stoneBase });
    }

    if (variant === 3) {
      // Recessed shadow-line panel strips on all 4 wall faces
      const panelH = H * 0.7;
      const panelY = floorY + H / 2;

      // Front and back (z-facing faces): strips along X
      for (const zc of [halfD, -halfD]) {
        for (let frac = 1; frac <= 3; frac++) {
          const px = -halfW + (W * frac) / 4;
          decor.push({ s: [0.08, panelH, WALL_T + 0.06], p: [px, panelY, zc], mat: MAT.woodTrim });
        }
      }
      // Left and right (x-facing faces): strips along Z
      for (const xc of [halfW, -halfW]) {
        for (let frac = 1; frac <= 3; frac++) {
          const pz = -halfD + (D * frac) / 4;
          decor.push({ s: [WALL_T + 0.06, panelH, 0.08], p: [xc, panelY, pz], mat: MAT.woodTrim });
        }
      }

      // Balcony railing on upper-floor front window (2-storey only)
      if (storeys === 2) {
        const balconyY = floorY + STOREY_H;
        const railY = balconyY + 0.5;
        // horizontal rail
        decor.push({ s: [WW + 0.6, 0.06, 0.06], p: [0, railY, halfD + 0.06], mat: MAT.woodTrim });
        // 3 balusters
        for (let b = -1; b <= 1; b++) {
          decor.push({ s: [0.06, 0.5, 0.06], p: [b * (WW / 3), balconyY + 0.25, halfD + 0.06], mat: MAT.woodTrim });
        }
        // small balcony slab
        decor.push({ s: [WW + 0.6, 0.08, 0.5], p: [0, balconyY, halfD + 0.19], mat: MAT.stoneBase });
      }
    }

    return { walls, decor, windows };
  }, [W, D, storeys, wallMat, floorY, halfW, halfD, variant, H, wallTop]);

  // ---- merge all box-based segments by material into one mesh each ----
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
      // Dispose the individual pre-merge geometries
      for (const g of geos) g.dispose();
    }
    return result;
  }, [walls, decor]);

  // Dispose merged geometries on unmount / dependency change
  useEffect(() => () => { mergedMeshes.forEach(m => m.geo.dispose()); }, [mergedMeshes]);

  // gable end triangles (custom tri-mesh — kept separate, not merged)
  const gableGeo = useMemo(() => {
    const g = new THREE.BufferGeometry();
    g.setAttribute(
      "position",
      new THREE.BufferAttribute(
        new Float32Array([
          halfW, wallTop, -halfD, halfW, wallTop, halfD, halfW, ridgeY, 0,
          -halfW, wallTop, halfD, -halfW, wallTop, -halfD, -halfW, ridgeY, 0,
        ]),
        3,
      ),
    );
    g.computeVertexNormals();
    return g;
  }, [halfW, halfD, wallTop, ridgeY]);
  useEffect(() => () => gableGeo.dispose(), [gableGeo]);

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
        <BreakableWindow key={`g${i}`} position={w.pos} width={WW} height={WH} facing={w.facing} />
      ))}

      {/* roof: shallow gable (standable) + ridge cap + gable ends */}
      <mesh position={[0, (wallTop + ridgeY) / 2, halfDe / 2]} rotation={[theta, 0, 0]} material={MAT.roofShingle} castShadow receiveShadow>
        <boxGeometry args={[roofW, 0.16, slopeLen]} />
      </mesh>
      <mesh position={[0, (wallTop + ridgeY) / 2, -halfDe / 2]} rotation={[-theta, 0, 0]} material={MAT.roofShingle} castShadow receiveShadow>
        <boxGeometry args={[roofW, 0.16, slopeLen]} />
      </mesh>
      <mesh position={[0, ridgeY + 0.04, 0]} material={MAT.roofShingle}>
        <boxGeometry args={[roofW, 0.2, 0.24]} />
      </mesh>
      <mesh geometry={gableGeo} castShadow receiveShadow>
        <meshStandardMaterial color={alt ? "#b89878" : "#c7bfa6"} roughness={0.95} side={THREE.DoubleSide} />
      </mesh>

      {/* chimney */}
      <mesh position={[halfW * 0.45, wallTop + ridgeRise * 0.5, -halfD * 0.25]} material={MAT.chimney} castShadow>
        <boxGeometry args={[0.5, ridgeRise + 0.9, 0.5]} />
      </mesh>

      {/* colliders: wall/floor/stair segments + plinth + standable roof slopes */}
      <RigidBody type="fixed" colliders={false}>
        <CuboidCollider args={[(W + 0.4) / 2, PLINTH_H / 2, (D + 0.4) / 2]} position={[0, PLINTH_H / 2, 0]} />
        {walls.map((g, i) => (
          <CuboidCollider key={i} args={[g.s[0] / 2, g.s[1] / 2, g.s[2] / 2]} position={g.p} />
        ))}
        <CuboidCollider args={[roofW / 2, 0.08, slopeLen / 2]} position={[0, (wallTop + ridgeY) / 2, halfDe / 2]} rotation={[theta, 0, 0]} />
        <CuboidCollider args={[roofW / 2, 0.08, slopeLen / 2]} position={[0, (wallTop + ridgeY) / 2, -halfDe / 2]} rotation={[-theta, 0, 0]} />
      </RigidBody>
    </group>
  );
}
