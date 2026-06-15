"use client";

import { Suspense } from "react";
import { Canvas } from "@react-three/fiber";
import {
  OrbitControls,
  RoundedBox,
  ContactShadows,
  AdaptiveDpr,
  Preload,
  useProgress,
} from "@react-three/drei";
import * as THREE from "three";
import { LoadingScreen } from "@/components/LoadingScreen";

/**
 * Scaffold scene — proves R3F + drei + lighting + shadows render.
 * Real world (ground collider, buildings, cover) lands in the level phase;
 * this is just a beveled placeholder so the canvas is visibly alive.
 */
function PlaceholderScene() {
  return (
    <group>
      <hemisphereLight args={["#9fc4d6", "#1a232b", 0.5]} />
      <ambientLight intensity={0.25} />
      <directionalLight
        position={[8, 14, 6]}
        intensity={2.2}
        castShadow
        shadow-mapSize={[2048, 2048]}
        shadow-camera-near={1}
        shadow-camera-far={40}
        shadow-camera-left={-20}
        shadow-camera-right={20}
        shadow-camera-top={20}
        shadow-camera-bottom={-20}
      />
      <pointLight position={[-4, 3, -3]} intensity={12} color="#4cc9f0" distance={14} />

      {/* placeholder structures — beveled, not flat boxes */}
      {[
        [0, 1, 0],
        [3.5, 0.75, -2],
        [-3, 1.4, -1.5],
      ].map(([x, y, z], i) => (
        <RoundedBox
          key={i}
          args={[1.8, y * 2, 1.8]}
          radius={0.08}
          smoothness={4}
          position={[x, y, z]}
          castShadow
          receiveShadow
        >
          <meshStandardMaterial
            color={i === 0 ? "#39424b" : "#2b333b"}
            roughness={0.7}
            metalness={0.15}
          />
        </RoundedBox>
      ))}

      {/* visual ground (no physics yet) */}
      <mesh rotation={[-Math.PI / 2, 0, 0]} receiveShadow>
        <planeGeometry args={[60, 60]} />
        <meshStandardMaterial color="#161b20" roughness={0.95} metalness={0.05} />
      </mesh>

      <ContactShadows
        position={[0, 0.01, 0]}
        opacity={0.5}
        scale={30}
        blur={2.4}
        far={10}
      />
    </group>
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
        shadows
        dpr={[1, 2]}
        gl={{ antialias: true, powerPreference: "high-performance" }}
        camera={{ position: [6, 5, 8], fov: 60, near: 0.1, far: 200 }}
        onCreated={({ scene }) => {
          scene.background = new THREE.Color("#0a0f14");
          scene.fog = new THREE.Fog("#0a0f14", 18, 60);
        }}
      >
        <Suspense fallback={null}>
          <PlaceholderScene />
          <Preload all />
        </Suspense>
        <OrbitControls makeDefault enableDamping />
        <AdaptiveDpr pixelated />
      </Canvas>
      <ProgressOverlay />
    </>
  );
}
