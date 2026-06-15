# Recon — Browser Stealth FPS

A Project IGI-style stealth FPS that runs in the browser. Built on Next.js (App
Router) + Three.js via React Three Fiber, with Rapier physics. Passion project —
the bar is **smooth and playable**, not photoreal.

## Stack

| Concern   | Choice |
|-----------|--------|
| Framework | Next.js (App Router), strict TypeScript |
| Rendering | `@react-three/fiber` + `@react-three/drei` (Three.js) |
| Physics   | `@react-three/rapier` (Rapier WASM) |
| State     | `zustand` — **transient subscriptions** in the loop, not reactive setters |
| Tooling   | bun (install + scripts), ESLint, `tsc --noEmit` |

## Run

```bash
bun install
bun run dev        # http://localhost:3000
bun run typecheck  # strict tsc, no emit
bun run lint
```

The WebGL canvas is loaded **client-only** (`next/dynamic`, `ssr: false`) behind a
DOM loading screen — WebGL never runs on the server. `reactStrictMode` is **off**
(`next.config.ts`) because StrictMode's double-invoke double-initialises Rapier/r3f.

## Architecture

All gameplay code lives under `src/game`, split by responsibility. UI is plain
React under `src/components`; reusable React glue under `src/hooks`.

```
src/
  app/            Next App Router (layout, page, globals.css)
  components/     React UI — GameShell, GameCanvas, LoadingScreen, HUD
  hooks/          useInput, useGameLoop, usePointerLock
  game/
    core/         engine bootstrap, render loop, fixed-timestep clock
    systems/      input, movement, camera, ai, stealth, weapons, audio
    entities/     player, enemy, weapon, props — each self-contained
    weapons/      weapon defs (pistol/AR/sniper), recoil, reload FSM
    levels/       level layout, building placement, spawn data
    ai/           FSM (patrol/alert/search/combat), waypoints, vision cone
    physics/      Rapier colliders, raycast helpers
    state/        zustand stores (player, world, weapons, hud)
    utils/        math, object pooling, asset loaders
```

### The system/entity contract

Every system and entity exposes the same lifecycle so the engine can drive them
uniformly and tear them down cleanly:

```ts
interface GameModule {
  init(ctx: GameContext): void;   // allocate, subscribe, build meshes/colliders
  update(dt: number): void;       // advance by delta seconds (called from useFrame)
  dispose(): void;                // free geometry/materials/textures, unsubscribe
}
```

- **`update(dt)`** uses the frame delta — never wall-clock — so motion is
  framerate-independent. Physics runs on a **fixed timestep** with render
  interpolation; visuals never tunnel or stutter at variable FPS.
- **`dispose()`** is mandatory: geometry, materials, and textures are GPU
  resources that Three.js will not garbage-collect for you.

### Performance rules (target: stable 60 fps)

- No React re-renders in the game loop. Read state through **Zustand transient
  subscriptions** (`store.subscribe`) and mutate Three.js objects via refs.
- **Object pooling** for bullets, tracers, and muzzle flashes — zero per-frame
  allocation in the hot loop.
- **Instanced meshes** for repeated props (crates, barrels); frustum culling on;
  low draw calls.
- Draco/meshopt-compressed GLB, lazy-loaded behind the loading screen.

### Typed configs, no magic values

Weapons, camera modes, AI states, and input bindings are typed enums/configs.
Adding content is data, not new branches:

- **New weapon** → add a `WeaponDef` in `game/weapons` (damage, fire rate, mag,
  reload, recoil, ADS fov, model, anim set). The weapon FSM and HUD consume it.
- **New enemy** → add a GLB + spawn entry; the AI FSM and animation driver are
  shared.
- **New level** → add layout/spawn data in `game/levels`.

## Controls

| Input | Action |
|-------|--------|
| WASD | Move |
| Shift | Sprint |
| Ctrl | Crouch |
| Space | Jump |
| 1 / 2 / 3 | Pistol / AR / Sniper |
| R | Reload |
| LMB | Fire |
| RMB | Aim down sights |
| V | Toggle first / third person |
| E | Interact |

## Build order (one milestone at a time, each committed)

1. **Scaffold** ✅ — Next + r3f + drei + rapier + zustand, folder tree, booting canvas, loading screen.
2. Core loop + Rapier world (fixed timestep + render interpolation).
3. Character controller (accel/damping, sprint, crouch, jump, pointer lock).
4. Dual FP/TP camera (V toggle, collision-aware TP spring arm).
5. Flat ground + building level + cover props (colliders).
6. Player viewmodel + 3 weapons + weapon FSM (idle/fire/reload/ADS).
7. Enemy GLB + patrol FSM + vision cone, velocity-driven animation.
8. HUD: health, ammo/mag, weapon, detection indicator, camera mode.

Each milestone is a rollback-safe commit.
