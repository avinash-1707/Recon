"use client";

import { Suspense } from "react";
import { Canvas } from "@react-three/fiber";
import { ContactShadows, AdaptiveDpr, Preload, Stats, useProgress } from "@react-three/drei";
import { Physics } from "@react-three/rapier";
import * as THREE from "three";
import { LoadingScreen } from "@/components/LoadingScreen";
import { DevControls } from "@/components/DevControls";
import { PlayOverlay } from "@/components/PlayOverlay";
import { CoreSystems } from "@/components/CoreSystems";
import { Crosshair } from "@/components/Crosshair";
import { ScopeOverlay } from "@/components/ScopeOverlay";
import { Hud } from "@/components/Hud";
import { EngineProvider, EngineRunner } from "@/game/core/engineContext";
import { useWorldStore } from "@/game/state/worldStore";
import { Player } from "@/game/entities/Player";
import { WeaponRig } from "@/game/entities/WeaponRig";
import { Enemies } from "@/game/entities/Enemies";
import { HealthPickups } from "@/game/entities/HealthPickups";
import { AmmoPickups } from "@/game/entities/AmmoPickups";
import { JumpPads } from "@/game/entities/JumpPads";
import TownLevel from "@/game/levels/TownLevel";

function Lights() {
  return (
    <>
      <hemisphereLight args={["#9fc4d6", "#1a232b", 0.5]} />
      <ambientLight intensity={0.25} />
      <directionalLight
        position={[10, 16, 8]}
        intensity={2.2}
        castShadow
        shadow-mapSize={[2048, 2048]}
        shadow-camera-near={1}
        shadow-camera-far={50}
        shadow-camera-left={-24}
        shadow-camera-right={24}
        shadow-camera-top={24}
        shadow-camera-bottom={-24}
        shadow-bias={-0.0004}
      />
      <pointLight position={[-6, 4, -4]} intensity={14} color="#4cc9f0" distance={18} />
    </>
  );
}

/**
 * Physics world + engine runner. <Physics> owns the fixed stepper (timeStep)
 * and render interpolation; `updatePriority={-50}` steps physics before the
 * engine's useFrame so we read fresh interpolated transforms. `paused`/`debug`
 * are reactive config (toggled rarely) - fine to read with a selector here.
 */
function World() {
  const paused = useWorldStore((s) => s.paused);
  const debug = useWorldStore((s) => s.debugPhysics);
  return (
    <Physics
      timeStep={1 / 60}
      interpolate
      paused={paused}
      debug={debug}
      gravity={[0, -9.81, 0]}
      updatePriority={-50}
    >
      <EngineRunner />
      <CoreSystems />
      <TownLevel />
      <Player />
      <WeaponRig />
      <Enemies />
      <HealthPickups />
      <AmmoPickups />
      <JumpPads />
    </Physics>
  );
}

/** DOM overlay bridging drei's loading manager to the loading screen. */
function ProgressOverlay() {
  const { active, progress, item } = useProgress();
  if (!active) return null;
  return <LoadingScreen progress={progress} label={item ? `Loading ${item}` : "Loading"} />;
}

export function GameCanvas() {
  return (
    <>
      <Canvas
        shadows={{ type: THREE.PCFShadowMap }}
        dpr={[1, 2]}
        gl={{ antialias: true, powerPreference: "high-performance" }}
        camera={{ position: [9, 6, 11], fov: 60, near: 0.1, far: 200 }}
        onCreated={({ scene }) => {
          scene.background = new THREE.Color("#0a0f14");
          scene.fog = new THREE.Fog("#0a0f14", 22, 70);
        }}
      >
        <Suspense fallback={null}>
          <Lights />
          <EngineProvider>
            <World />
          </EngineProvider>
          <ContactShadows position={[0, 0.01, 0]} opacity={0.35} scale={60} blur={2.6} far={14} frames={1} />
          <Preload all />
        </Suspense>
        <AdaptiveDpr pixelated />
        <Stats />
      </Canvas>
      <Hud />
      <Crosshair />
      <ScopeOverlay />
      <ProgressOverlay />
      <PlayOverlay />
      <DevControls />
    </>
  );
}
