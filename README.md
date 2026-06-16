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
| Ctrl / C | Crouch |
| Space | Jump |
| 1 / 2 / 3 / 4 | Pistol / AR / Sniper / Knife |
| R | Reload |
| LMB | Fire / melee swing |
| RMB | Aim down sights |
| E | Interact |
| Esc | Release cursor |

First-person only. `?test=1` forces input active without real pointer lock (for headless smoke tests).

## Gameplay

- **Map** — enclosed town (~20 buildings: 1/2-storey houses + warehouses) around a central plaza with streets and cover. Houses have textured walls, **breakable translucent windows** (shoot to shatter, then see/shoot through), interior **stairs** to a second floor, and standable roofs. **Jump pads** in the streets launch you onto rooftops.
- **Weapons** — pistol / AR (red-dot) / sniper (scope) / combat knife, each a typed config; animated viewmodel (fire/reload/ADS/swing), hitscan with **headshot** (red) vs **bodyshot** (white) hitmarkers, pooled tracers + muzzle flashes, procedural WebAudio SFX, auto-reload.
- **Enemies** — rigged soldiers (idle/walk/run blend) with a patrol → alert → search → combat FSM + vision cone; they carry visible rifles, only fire while stationary, and spawn dispersed. On death they vanish and leave a blood decal.
- **Survival** — health + ammo pickups (mostly inside houses); damage vignette; on death, release cursor → **REDEPLOY** respawns you inside a random house with full health + ammo.

## Build order (each a rollback-safe commit)

1. **Scaffold** — Next + r3f + drei + rapier + zustand.
2. **Core loop + Rapier** — fixed timestep + render interpolation.
3. **Character controller** — accel/damping, sprint, crouch, jump, pointer lock.
4. **Camera** — first-person (third-person was later removed).
5. **Level + cover** — ground, buildings, props, colliders → later expanded into the town.
6. **Weapons** — viewmodel + FSM (idle/fire/reload/ADS) + hitscan + FX + audio + knife.
7. **Enemy AI** — GLB + patrol/alert/search/combat FSM + vision cone + headshots.
8. **HUD** — minimal COD-style: health, ammo, detection, hostiles, hitmarkers.
9. **Polish** — town map, breakable windows, stairs, jump pads, pickups, respawn.
