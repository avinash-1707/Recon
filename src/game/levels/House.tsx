"use client";

import { useEffect, useMemo } from "react";
import * as THREE from "three";
import { RigidBody, CuboidCollider } from "@react-three/rapier";
import { MAT } from "@/game/levels/materials";
import { BreakableWindow } from "@/game/levels/BreakableWindow";

export interface HouseProps {
  position: [number, number, number];
  rotationY?: number;
  storeys?: 1 | 2;
  width?: number;
  depth?: number;
  alt?: boolean;
}

const STOREY_H = 2.8;
const WALL_T = 0.25;
const PLINTH_H = 0.35;
const DOOR_W = 1.1;
const DOOR_H = 2.1;
const EAVE = 0.45;
const SILL = 1.0; // window sill height above each storey floor
const WW = 1.5; // window opening width
const WH = 1.3; // window opening height
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

/**
 * Detailed PUBG-style house: textured plastered walls with real window
 * OPENINGS filled by breakable translucent glass, a front door, a textured
 * gable roof shallow enough to stand on (with slope colliders), a chimney, and
 * — for 2-storey — an upper floor reached by an interior staircase.
 */
export function House({ position, rotationY = 0, storeys = 1, width = 8, depth = 7, alt = false }: HouseProps) {
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

  // ---- build wall segments + window openings ----
  const { walls, decor, windows } = useMemo(() => {
    const walls: Seg[] = [];
    const decor: Seg[] = [];
    const windows: Win[] = [];
    const zb = halfD - WALL_T / 2;
    const xb = halfW - WALL_T / 2;
    const headerH = STOREY_H - (SILL + WH);
    const pillarW = (W - WW) / 2;
    const pillarD = (D - WW) / 2;

    const windowWallX = (zc: number, base: number) => {
      // wall spanning X at z=zc, central window
      walls.push({ s: [W, SILL, WALL_T], p: [0, base + SILL / 2, zc], mat: wallMat });
      walls.push({ s: [W, headerH, WALL_T], p: [0, base + SILL + WH + headerH / 2, zc], mat: wallMat });
      walls.push({ s: [pillarW, WH, WALL_T], p: [-(W / 2 - pillarW / 2), base + SILL + WH / 2, zc], mat: wallMat });
      walls.push({ s: [pillarW, WH, WALL_T], p: [W / 2 - pillarW / 2, base + SILL + WH / 2, zc], mat: wallMat });
      decor.push({ s: [WW + 0.2, 0.1, WALL_T + 0.08], p: [0, base + SILL, zc], mat: MAT.woodTrim }); // sill ledge
      windows.push({ pos: [0, base + SILL + WH / 2, zc], facing: "z" });
    };
    const windowWallZ = (xc: number, base: number) => {
      walls.push({ s: [WALL_T, SILL, D], p: [xc, base + SILL / 2, 0], mat: wallMat });
      walls.push({ s: [WALL_T, headerH, D], p: [xc, base + SILL + WH + headerH / 2, 0], mat: wallMat });
      walls.push({ s: [WALL_T, WH, pillarD], p: [xc, base + SILL + WH / 2, -(D / 2 - pillarD / 2)], mat: wallMat });
      walls.push({ s: [WALL_T, WH, pillarD], p: [xc, base + SILL + WH / 2, D / 2 - pillarD / 2], mat: wallMat });
      decor.push({ s: [WALL_T + 0.08, 0.1, WW + 0.2], p: [xc, base + SILL, 0], mat: MAT.woodTrim });
      windows.push({ pos: [xc, base + SILL + WH / 2, 0], facing: "x" });
    };

    for (let s = 0; s < storeys; s++) {
      const base = floorY + s * STOREY_H;
      windowWallX(-zb, base); // back
      windowWallZ(-xb, base); // left
      windowWallZ(xb, base); // right
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
      const SW = 2.0; // stair run width (along X, left side)
      const LANDING = 1.0; // clear floor in front of the stairs on both levels
      const fy = floorY + STOREY_H;
      const x0 = -halfW + WALL_T; // inner left edge
      const z0 = -halfD + WALL_T; // inner back edge
      // stair run occupies the middle of the left bay; landings fore and aft.
      const hz0 = z0 + LANDING; // run start (bottom landing behind it)
      const hz1 = z0 + innerD - LANDING; // run end (top landing in front)
      const run = hz1 - hz0;

      // upper floor = footprint minus a hole only over the stair run (3 strips → landings remain)
      walls.push({ s: [innerW - SW, FLOOR_T, innerD], p: [x0 + SW + (innerW - SW) / 2, fy, 0], mat: MAT.woodTrim }); // right of stairs
      walls.push({ s: [SW, FLOOR_T, LANDING], p: [x0 + SW / 2, fy, z0 + LANDING / 2], mat: MAT.woodTrim }); // back landing
      walls.push({ s: [SW, FLOOR_T, LANDING], p: [x0 + SW / 2, fy, hz1 + LANDING / 2], mat: MAT.woodTrim }); // front (top) landing

      // solid staircase rising over the run; each riser < autostep height
      const nSteps = 13;
      const stepH = STOREY_H / nSteps; // ~0.22 < 0.5 autostep
      const tread = run / nSteps;
      for (let i = 0; i < nSteps; i++) {
        const h = (i + 1) * stepH; // box from floor up to this tread
        walls.push({
          s: [SW * 0.92, h, tread + 0.01],
          p: [x0 + SW / 2, floorY + h / 2, hz0 + (i + 0.5) * tread],
          mat: MAT.stoneBase,
        });
      }
    }

    return { walls, decor, windows };
  }, [W, D, storeys, wallMat, floorY, halfW, halfD]);

  // gable end triangles
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

      {/* wall + floor segments (visual) */}
      {walls.map((g, i) => (
        <mesh key={`w${i}`} position={g.p} material={g.mat} castShadow receiveShadow>
          <boxGeometry args={g.s} />
        </mesh>
      ))}
      {/* decor (no collider) */}
      {decor.map((g, i) => (
        <mesh key={`d${i}`} position={g.p} material={g.mat} castShadow receiveShadow>
          <boxGeometry args={g.s} />
        </mesh>
      ))}
      {/* breakable glass windows */}
      {windows.map((w, i) => (
        <BreakableWindow key={`g${i}`} position={w.pos} width={WW} height={WH} facing={w.facing} />
      ))}

      {/* roof: shallow gable (standable) + ridge + gable ends */}
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
