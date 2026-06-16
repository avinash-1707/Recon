# Recon

A browser first-person shooter built with Next.js + Three.js and Rapier physics.
You drop into an enclosed town of houses and warehouses, four weapons in the
loadout, and clear out roaming soldiers. The bar is **smooth and playable** (target
stable 60 fps), not photoreal. COD/PUBG-flavoured arcade combat.

## Stack

| Concern   | Choice |
|-----------|--------|
| Framework | Next.js 16 (App Router), strict TypeScript |
| Rendering | `@react-three/fiber` + `@react-three/drei` (Three.js) |
| Physics   | `@react-three/rapier` (Rapier WASM) |
| State     | `zustand` (transient subscriptions in the loop, not reactive setters) |
| Audio     | Web Audio API (procedural synthesis) |
| Tooling   | bun (install + scripts), ESLint, `tsc --noEmit`, puppeteer-core smoke test |

## Run

```bash
bun install
bun run dev        # http://localhost:3000
bun run typecheck  # strict tsc, no emit
bun run lint
```

Then open `http://localhost:3000` and click the canvas to lock the pointer and play.

The WebGL canvas is loaded **client-only** (`next/dynamic`, `ssr: false`) behind a
DOM loading screen, so WebGL never runs on the server. `reactStrictMode` is **off**
(`next.config.ts`) because StrictMode's double-invoke double-initialises Rapier/r3f.

## Controls

| Input | Action |
|-------|--------|
| WASD | Move |
| Shift | Sprint |
| Ctrl / C | Crouch |
| Space | Jump |
| 1 / 2 / 3 / 4 | Pistol / AR / Sniper / Knife |
| R | Reload |
| LMB | Fire (or melee swing) |
| RMB | Aim down sights |
| E | Interact |
| Esc | Release cursor |
| `` ` `` | Toggle Rapier collider debug |
| P | Pause / resume the simulation |

First-person only.

## Gameplay

- **Map** - an enclosed town of ~20 buildings (1- and 2-storey houses plus
  warehouses) around a central plaza, with streets and scattered cover. Houses
  have textured walls, **breakable translucent windows** (shoot the glass to
  shatter it, then see and shoot through the hole), an interior **staircase** to a
  second floor with landings, and standable roofs. **Jump pads** in the streets
  launch you onto rooftops.
- **Weapons** - pistol, AR (red-dot sight), sniper (scope), and a combat knife.
  Each is a typed config that drives an animated first-person viewmodel
  (fire / reload / ADS / melee swing). Hitscan firing with **headshot** (red
  marker) vs **bodyshot** (white marker) feedback, pooled tracers and muzzle
  flashes, per-weapon procedural gunfire SFX, and auto-reload on empty.
- **Enemies** - rigged soldiers with idle/walk/run animation blended by speed and
  a `patrol -> alert -> search -> combat` FSM driven by a vision cone (range +
  field-of-view + line-of-sight raycast). They carry visible rifles, only fire
  while stationary, and spawn dispersed across the map. On death they vanish and
  leave a blood decal.
- **Survival** - health kits and ammo crates (mostly inside houses) restock you;
  taking damage flashes a red vignette. On death the cursor is released so you can
  click **REDEPLOY**, which respawns you inside a random house with full health
  and ammo.

## Architecture

All gameplay code lives under `src/game`, split by responsibility. UI is plain
React under `src/components`; reusable React glue under `src/hooks`.

```
src/
  app/            Next App Router (layout, page, globals.css, icon)
  components/     React UI - GameCanvas, HUD, Crosshair, ScopeOverlay,
                  PlayOverlay, LoadingScreen, CoreSystems, DevControls
  hooks/          useGameLoop, usePointerLock
  game/
    core/         engine, fixed-timestep clock, GameModule/GameContext types,
                  React engine provider + runner
    systems/      input, camera, weapons, viewmodel, ai, effects, audio, combat
    entities/     Player, WeaponRig, Enemies, HealthPickups, AmmoPickups, JumpPads,
                  playerController
    weapons/      typed weapon defs, weapon FSM, procedural weapon models
    levels/       TownLevel, House, Building, Props, materials, layout, spawns
    ai/           enemy FSM tuning, EnemyAgent, vision cone
    physics/      hitscan raycast helper
    state/        zustand stores (player, world, weapons, hud) + transient runtime
    utils/        object pool, procedural textures, decals
```

### The module contract

Every system and entity implements one lifecycle so the engine drives them
uniformly and tears them down cleanly:

```ts
interface GameModule {
  readonly id: string;
  readonly order?: number;          // pins update order (input -> controllers -> ai -> weapons -> camera)
  init(ctx: GameContext): void;     // allocate, subscribe, build meshes/colliders
  fixedUpdate?(dt: number): void;   // deterministic fixed-step logic (optional)
  update(dt: number, alpha: number): void; // per-frame; alpha = interpolation factor
  dispose(): void;                  // free geometry/materials/textures, unsubscribe
}
```

- The engine runs `fixedUpdate(dt)` in fixed slices (60 Hz) via a `FixedClock`
  accumulator, then a variable `update(dt, alpha)` pass. `alpha` (0..1) lets
  render code interpolate between the last two fixed states, so motion stays
  smooth at any framerate. Rapier runs its own fixed stepper with render
  interpolation for rigid bodies.
- `dispose()` is mandatory: geometry, materials, and textures are GPU resources
  Three.js will not garbage-collect for you.

### Performance rules (target: stable 60 fps)

- No React re-renders in the game loop. Per-frame state lives in a plain mutable
  `runtime` object; discrete UI state lives in Zustand stores read via **transient
  subscriptions** (`store.subscribe`) or on discrete events only.
- **Object pooling** for tracers and muzzle flashes (`FixedPool`) - zero per-frame
  allocation in the hot loop.
- **Instanced meshes** for repeated props (crates, barrels); shared materials;
  baked contact shadows for the static scene.

### Typed configs, no magic values

Weapons, weapon FSM states, AI states, and input bindings are typed enums/configs.
Adding content is data, not new branches:

- **New weapon**: add a `WeaponDef` in `game/weapons/defs.ts` (damage, rpm, mag,
  reload, recoil, ADS fov, melee flag, ...) plus a model case in `models.ts`. The
  FSM, viewmodel, hitscan, FX, and HUD all read the def.
- **New enemy**: clones the shared rigged GLB per spawn; add a spawn entry in
  `levels/spawns.ts`. The AI FSM and animation driver are shared.
- **New level**: add building layout in `levels/layout.ts` + a level component;
  spawn/patrol data in `levels/spawns.ts`.

## Assets

- **Enemy model**: `public/models/Soldier.glb` - the rigged soldier from the
  three.js examples (idle / walk / run clips), cloned per enemy with
  `SkeletonUtils`.
- **Everything else is procedural / code-built**: weapons, buildings, houses,
  props, ground and house textures (canvas-generated), blood decals, and all
  gunfire/reload/melee audio (Web Audio synthesis). This keeps the project free of
  asset-download dependencies and gives full control over animation.

To use real CC0 GLB weapons/props instead, drop them in `public/models` and load
them in place of the procedural builders.

## Testing

`scripts/smoke.mjs` is a headless smoke test (puppeteer-core + system Chrome) that
loads the game, drives input, captures console errors, and screenshots:

```bash
bun run dev &                                   # serve first
node scripts/smoke.mjs "http://localhost:3000/?test=1" /tmp/out.png
```

The `?test=1` query enables a dev-only input hook so a headless browser can drive
the mouse without a real pointer lock (it is inert in normal play).

## Build history

Built one milestone at a time, each a rollback-safe commit:

1. Scaffold (Next + r3f + drei + rapier + zustand).
2. Core loop + Rapier world (fixed timestep + render interpolation).
3. Kinematic character controller (accel/damping, sprint, crouch, jump, pointer lock).
4. First-person camera.
5. Level + cover props with colliders (later expanded into the town).
6. Weapons: animated viewmodel + FSM + hitscan + pooled FX + audio + knife.
7. Enemy AI: GLB + patrol/alert/search/combat FSM + vision cone + headshots.
8. Minimal HUD (health, ammo, detection, hostiles, hitmarkers).
9. Polish: town map, breakable windows, interior stairs, jump pads, pickups, house respawn.

## License

Personal passion project. The bundled `Soldier.glb` originates from the three.js
examples; see the three.js repository for its terms.
