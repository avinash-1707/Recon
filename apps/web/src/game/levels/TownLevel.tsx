"use client";

import { useEffect } from "react";
import { Sky } from "@react-three/drei";
import { RigidBody, CuboidCollider } from "@react-three/rapier";
import { Building } from "@/game/levels/Building";
import { House } from "@/game/levels/House";
import { SquadHouse } from "@/game/levels/SquadHouse";
import { OpenRoofTower } from "@/game/levels/OpenRoofTower";
import { CoverProps } from "@/game/levels/Props";
import { Furniture } from "@/game/levels/Furniture";
import { MAT, disposeLevelMaterials } from "@/game/levels/materials";
import { PLOTS, SPACING, HALF, TOWN_HALF } from "@/game/levels/layout";

const BORDER = TOWN_HALF + 8; // perimeter wall radius
const GROUND = BORDER * 2 + 24;
const WALL_H = 5;
const WALL_T = 1.2;

const AVENUE_W = 11; // wide main avenues (x=0, z=0)
const STREET_W = 5; // secondary streets between blocks
const ROAD_LEN = TOWN_HALF * 2 + SPACING; // span a touch beyond outer plots
const SIDEWALK_W = 2;

/** Road centre-lines per axis: the wide central avenue (0) + a street in each
 *  gap between plot rows ((g+0.5)*SPACING). Buildings sit in the grass blocks
 *  between these lines. */
function roadLines(): { c: number; w: number }[] {
  const lines: { c: number; w: number }[] = [{ c: 0, w: AVENUE_W }];
  for (let g = -HALF; g < HALF; g++) lines.push({ c: (g + 0.5) * SPACING, w: STREET_W });
  return lines;
}

/**
 * Enclosed town map (~2x the original): a 9x9 block grid of houses + warehouses
 * around the central N-S/E-W avenues, on grass with an asphalt road grid,
 * sidewalks, and a closed perimeter wall. Static colliders; terrain is visual
 * only (flat ground collider handles walking).
 */
export default function TownLevel() {
  useEffect(() => () => disposeLevelMaterials(), []);

  const lines = roadLines();

  return (
    <>
      <Sky distance={450000} sunPosition={[40, 28, 20]} turbidity={9} rayleigh={3} mieCoefficient={0.012} mieDirectionalG={0.82} />

      {/* ground collider (flat) */}
      <RigidBody type="fixed" colliders={false} friction={1}>
        <CuboidCollider args={[GROUND / 2, 0.5, GROUND / 2]} position={[0, -0.5, 0]} />
      </RigidBody>

      {/* terrain: grass base */}
      <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, 0, 0]} receiveShadow material={MAT.grass}>
        <planeGeometry args={[GROUND, GROUND]} />
      </mesh>

      {/* roads (run along Z) */}
      {lines.map((l, i) => (
        <mesh key={`vr${i}`} rotation={[-Math.PI / 2, 0, 0]} position={[l.c, 0.03, 0]} material={MAT.asphalt}>
          <planeGeometry args={[l.w, ROAD_LEN]} />
        </mesh>
      ))}
      {/* roads (run along X) */}
      {lines.map((l, i) => (
        <mesh key={`hr${i}`} rotation={[-Math.PI / 2, 0, 0]} position={[0, 0.031, l.c]} material={MAT.asphalt}>
          <planeGeometry args={[ROAD_LEN, l.w]} />
        </mesh>
      ))}

      {/* sidewalks flanking the two main avenues */}
      {([-1, 1] as const).map((s) => (
        <group key={`sw${s}`}>
          <mesh rotation={[-Math.PI / 2, 0, 0]} position={[s * (AVENUE_W / 2 + SIDEWALK_W / 2), 0.02, 0]} material={MAT.sidewalk}>
            <planeGeometry args={[SIDEWALK_W, ROAD_LEN]} />
          </mesh>
          <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, 0.021, s * (AVENUE_W / 2 + SIDEWALK_W / 2)]} material={MAT.sidewalk}>
            <planeGeometry args={[ROAD_LEN, SIDEWALK_W]} />
          </mesh>
        </group>
      ))}

      {/* centre lines on the avenues */}
      <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, 0.05, 0]} material={MAT.laneLine}>
        <planeGeometry args={[0.3, ROAD_LEN]} />
      </mesh>
      <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, 0.051, 0]} material={MAT.laneLine}>
        <planeGeometry args={[ROAD_LEN, 0.3]} />
      </mesh>

      {/* perimeter wall (closed border) */}
      <PerimeterWall />

      {/* buildings */}
      {PLOTS.map((p, i) => {
        const at = { position: [p.x, 0, p.z] as [number, number, number], rotationY: p.yaw };
        if (p.kind === 2) {
          return <Building key={i} {...at} width={10} depth={8} height={7} />;
        }
        if (p.kind === 3) {
          return <SquadHouse key={i} {...at} variant={p.variant} alt={p.alt} />;
        }
        if (p.kind === 4) {
          return <OpenRoofTower key={i} {...at} variant={p.variant} alt={p.alt} />;
        }
        return (
          <House
            key={i}
            {...at}
            storeys={p.kind === 1 ? 2 : 1}
            width={p.kind === 1 ? 8 : 9}
            depth={p.kind === 1 ? 7 : 6}
            variant={p.variant}
            alt={p.alt}
          />
        );
      })}

      <CoverProps />
      <Furniture />
    </>
  );
}

function PerimeterWall() {
  const len = BORDER * 2 + WALL_T;
  return (
    <RigidBody type="fixed" colliders={false}>
      {([
        [0, BORDER, len, WALL_T],
        [0, -BORDER, len, WALL_T],
        [BORDER, 0, WALL_T, len],
        [-BORDER, 0, WALL_T, len],
      ] as const).map(([x, z, w, d], i) => (
        <group key={i}>
          <mesh position={[x, WALL_H / 2, z]} material={MAT.concreteDark} castShadow receiveShadow>
            <boxGeometry args={[w, WALL_H, d]} />
          </mesh>
          <mesh position={[x, WALL_H + 0.12, z]} material={MAT.trim}>
            <boxGeometry args={[w + 0.2, 0.3, d + 0.2]} />
          </mesh>
          <CuboidCollider args={[w / 2, WALL_H / 2, d / 2]} position={[x, WALL_H / 2, z]} />
        </group>
      ))}
      {([
        [BORDER, BORDER],
        [-BORDER, BORDER],
        [BORDER, -BORDER],
        [-BORDER, -BORDER],
      ] as const).map(([x, z], i) => (
        <mesh key={`c${i}`} position={[x, WALL_H * 0.7, z]} material={MAT.trim} castShadow>
          <boxGeometry args={[2, WALL_H * 1.4, 2]} />
        </mesh>
      ))}
    </RigidBody>
  );
}
