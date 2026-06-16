# Recon

A browser first-person shooter built with Next.js + Three.js and Rapier physics,
in two modes:

- **Single player** — drop into an enclosed town, four weapons in the loadout,
  and clear out roaming AI soldiers.
- **Multiplayer** — PvP free-for-all: create or join a room by code and fight
  other players in the same town (no AI). Optional sign-in saves your stats.

The bar is **smooth and playable** (target stable 60 fps), not photoreal —
COD/PUBG-flavoured arcade combat.

## Monorepo

A [Turborepo](https://turbo.build) monorepo on Bun workspaces.

```
recon/
├── apps/
│   ├── web/        Next.js client — game canvas, menu/lobby, HUD (both modes)
│   └── server/     Hono REST + socket.io relay (+ Better Auth handler)
├── packages/
│   ├── protocol/   @recon/protocol — shared zod socket/REST contract + types
│   ├── db/         @recon/db — Drizzle schema + Postgres/Neon client + migrations
│   ├── auth/       @recon/auth — Better Auth instance (email+password only)
│   ├── tsconfig/   shared tsconfig bases
│   └── eslint-config/  shared flat ESLint config
└── turbo.json
```

Packages ship raw TypeScript (no build step) and are consumed via workspace
imports — Bun runs them directly; Next transpiles them (`transpilePackages`).

## Stack

| Concern    | Choice |
|------------|--------|
| Monorepo   | Turborepo + Bun workspaces |
| Client     | Next.js 16 (App Router), `@react-three/fiber` + `drei` (Three.js), `@react-three/rapier` |
| State      | `zustand` (transient subscriptions in the loop, not reactive setters) |
| Backend    | [Hono](https://hono.dev) on `@hono/node-server` |
| Realtime   | `socket.io` (client-authoritative relay) |
| Database   | Postgres via [Neon](https://neon.tech), [Drizzle ORM](https://orm.drizzle.team) |
| Auth       | [Better Auth](https://better-auth.com) — email + password only (optional) |
| Validation | `zod` at every socket/REST boundary |
| Tooling    | Bun, ESLint (flat), `tsc --noEmit`, puppeteer-core smoke tests |

## Run

```bash
bun install
bun run dev          # turbo: web on :3000 + server on :8787 (parallel)
bun run typecheck    # tsc --noEmit across all packages
bun run lint
bun run build        # builds the web app
```

Open `http://localhost:3000`, pick **Single Player** or **Multiplayer**, then
click the canvas to lock the pointer and play.

### Environment

Copy the example env files and fill them in:

```bash
cp apps/server/.env.example apps/server/.env   # PORT, CLIENT_ORIGIN, DATABASE_URL, BETTER_AUTH_*
cp apps/web/.env.example    apps/web/.env       # NEXT_PUBLIC_SERVER_URL
cp packages/db/.env.example packages/db/.env    # DATABASE_URL (for migrations)
```

- **Guest multiplayer needs no database** — without `DATABASE_URL` the relay
  runs in-memory (rooms/matches/stats are not persisted) and auth is disabled.
- To **persist match results + stats and enable sign-in**, set `DATABASE_URL`
  to your Neon pooled connection string and a `BETTER_AUTH_SECRET`
  (`openssl rand -base64 32`), then apply the schema:

```bash
bun run db:migrate    # drizzle-kit migrate against DATABASE_URL
```

## Multiplayer

- **Mode**: PvP free-for-all in the town level; AI enemies are off.
- **Rooms**: a host creates a room (6-char code) over REST; others join by code.
  Up to 8 players per room. The lobby shows the live roster; start whenever.
- **Netcode**: **client-authoritative relay**. Each client owns its own player
  and broadcasts a ~20 Hz snapshot (position/look/stance/weapon/health); the
  server validates payloads (zod), stamps the authoritative sender id, and fans
  events out to the socket.io room. Remote players are interpolated, collidable
  capsules — your local hitscan hits them and reports the hit to the server, the
  victim applies the damage. Cheatable by design (a v1 trade-off); the server
  still validates all input so a bad client can't crash it.
- **Death**: a brief ELIMINATED beat, then auto-respawn at a scattered spawn.
- **Auth (optional)**: play as a guest with any handle, or sign in (email +
  password) so your kills/deaths/matches persist. The server derives your
  identity from the session cookie on the socket handshake; guests get no stats
  row. No social login.

The server is a long-lived Node process (socket.io needs a persistent server),
attached to the same HTTP server as the Hono app via `@hono/node-server`.

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
| Tab | Scoreboard (multiplayer) |
| Esc | Release cursor |
| `` ` `` | Toggle Rapier collider debug |
| P | Pause / resume the simulation |

First-person only.

## Game engine (apps/web)

Gameplay code lives under `apps/web/src/game`, split by responsibility; UI is
plain React under `apps/web/src/components`.

```
apps/web/src/
  app/            Next App Router (layout, page, globals.css, icon)
  components/     React UI — GameShell, GameCanvas, HUD, Scoreboard, menu/, ...
  hooks/          useGameLoop, usePointerLock, useIsTouch
  game/
    core/         engine, fixed-timestep clock, GameModule/GameContext types
    systems/      input, camera, weapons, viewmodel, ai, effects, audio, combat
    entities/     Player, WeaponRig, Enemies, RemotePlayers, pickups, playerController
    net/          socket client, session, NetworkSystem, peer registry, authClient
    weapons/      typed weapon defs, weapon FSM, procedural weapon models
    levels/       TownLevel, House, Building, Props, materials, layout, spawns
    ai/           enemy FSM tuning, EnemyAgent, vision cone
    physics/      hitscan raycast helper
    state/        zustand stores (player, world, weapons, hud, app, net) + runtime
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

The engine runs `fixedUpdate(dt)` in 60 Hz slices via a `FixedClock`
accumulator, then a variable `update(dt, alpha)` pass where `alpha` (0..1)
interpolates between the last two fixed states. `GameCanvas` registers different
modules per mode: single-player adds the AI system; multiplayer adds the
`NetworkSystem` + remote players and skips AI. `dispose()` is mandatory —
Three.js won't GC GPU resources for you.

### Performance rules (target: stable 60 fps)

- No React re-renders in the game loop. Per-frame state lives in a plain mutable
  `runtime` object; discrete UI state lives in Zustand stores read via transient
  subscriptions or on discrete events only.
- Object pooling for tracers/flashes (`FixedPool`); instanced meshes for repeated
  props; shared materials; baked contact shadows for the static scene.
- Network snapshots are sent at ~20 Hz (not 60) and interpolated on receivers.

## Assets

- **Soldier model**: `apps/web/public/models/Soldier.glb` — the rigged soldier
  from the three.js examples (idle/walk/run clips), cloned per enemy and per
  remote player with `SkeletonUtils`.
- **Everything else is procedural / code-built**: weapons, buildings, props,
  textures (canvas-generated), decals, and all audio (Web Audio synthesis).

## Testing

- **Relay smoke** (`apps/server/scripts/smoke.ts`): two socket.io clients join a
  room and exercise snapshot relay, target-only hit delivery, and the death
  tally. Point it at a running server:

  ```bash
  cd apps/server && bun run start &     # or PORT=8799 bun src/index.ts
  PORT=8787 bun run smoke
  ```

- **Web smoke** (`apps/web/scripts/smoke.mjs`): headless puppeteer-core that
  loads the game, drives input, and screenshots (`?test=1` enables a dev-only
  input hook).

## License

Personal passion project. The bundled `Soldier.glb` originates from the three.js
examples; see the three.js repository for its terms.
