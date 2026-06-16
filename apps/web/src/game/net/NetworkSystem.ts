import * as THREE from "three";
import type { GameModule } from "@/game/core/types";
import type { Engine } from "@/game/core/engine";
import {
  SNAPSHOT_INTERVAL_MS,
  type ClientSnapshot,
  type DeathEvent,
  type HitEvent,
  type PeerSnapshot,
  type ShotEvent,
} from "@recon/protocol";
import { playerRuntime } from "@/game/state/runtime";
import { Stance, usePlayerStore } from "@/game/state/playerStore";
import { useWeaponStore } from "@/game/state/weaponStore";
import { PLAYER_SPAWN } from "@/game/levels/spawns";
import type { FxSystem } from "@/game/systems/effects";
import { getSocket, type GameSocket } from "./socket";
import { onLocalShot } from "./combatBus";
import { applyPeerSnapshot, clearPeers } from "./remotePeers";

const _from = new THREE.Vector3();
const _to = new THREE.Vector3();
const _dir = new THREE.Vector3();
const PEER_TRACER_RANGE = 60;
const DEFAULT_TRACER = 0xffcf8f;
/** Death beat before auto-respawn (the ELIMINATED overlay shows during it). */
const RESPAWN_DELAY_S = 2.5;

/**
 * Multiplayer relay glue (runs only in multiplayer mode). Sends the local
 * player's snapshot at the protocol cadence, applies inbound peer events
 * (movement → peer registry, shots → tracers, hits → local damage), and owns
 * death/respawn (emitting `death` so the server can credit the kill).
 */
export class NetworkSystem implements GameModule {
  readonly id = "system.network";
  readonly order = 5; // after input (0), before player controller (10)

  private readonly socket: GameSocket = getSocket();
  private accumMs = 0;
  private lastAttacker: string | null = null;
  private dead = false;
  private respawnIn = 0;
  private fx: FxSystem | null = null;
  private unsubShot: (() => void) | null = null;
  private readonly offs: Array<() => void> = [];

  constructor(private readonly engine: Engine) {}

  init(): void {
    const onState = (s: PeerSnapshot) => applyPeerSnapshot(s);
    const onShot = (e: ShotEvent) => this.renderPeerShot(e);
    const onHit = (e: HitEvent) => {
      this.lastAttacker = e.shooterId;
      usePlayerStore.getState().damage(e.damage);
    };
    const onDeath = (_e: DeathEvent) => {
      // Remote deaths need no local action — the victim keeps streaming
      // snapshots after it respawns. Scoreboard updates via scoreUpdate.
    };

    this.socket.on("peerState", onState);
    this.socket.on("peerShot", onShot);
    this.socket.on("peerHit", onHit);
    this.socket.on("peerDeath", onDeath);
    this.offs.push(
      () => this.socket.off("peerState", onState),
      () => this.socket.off("peerShot", onShot),
      () => this.socket.off("peerHit", onHit),
      () => this.socket.off("peerDeath", onDeath),
    );

    this.unsubShot = onLocalShot((shot) => {
      this.socket.emit("shot", {
        origin: [shot.origin.x, shot.origin.y, shot.origin.z],
        dir: [shot.dir.x, shot.dir.y, shot.dir.z],
        weapon: shot.weapon,
        tracerColor: String(shot.tracerColor),
      });
    });
  }

  update(dt: number): void {
    const health = usePlayerStore.getState().health;
    if (!this.dead && health <= 0) {
      // Enter the death beat: emit once, then auto-respawn after a delay so the
      // ELIMINATED overlay can show (no instant revive fighting the UI).
      this.dead = true;
      this.respawnIn = RESPAWN_DELAY_S;
      this.socket.emit("death", { killerId: this.lastAttacker });
      this.lastAttacker = null;
    }
    if (this.dead) {
      this.respawnIn -= dt;
      if (this.respawnIn <= 0) this.respawn();
    }

    this.accumMs += dt * 1000;
    if (this.accumMs >= SNAPSHOT_INTERVAL_MS) {
      this.sendSnapshot();
      // Subtract one interval (don't zero) to hold a steady rate; drop the
      // backlog after a long stall so we don't burst-send.
      this.accumMs -= SNAPSHOT_INTERVAL_MS;
      if (this.accumMs > SNAPSHOT_INTERVAL_MS) this.accumMs = 0;
    }
  }

  private sendSnapshot(): void {
    const p = playerRuntime;
    const player = usePlayerStore.getState();
    const snap: ClientSnapshot = {
      pos: [p.position.x, p.position.y, p.position.z],
      yaw: p.yaw,
      pitch: p.pitch,
      vel: [p.velocity.x, p.velocity.y, p.velocity.z],
      stance: player.stance === Stance.Crouch ? "crouch" : "stand",
      weapon: useWeaponStore.getState().current,
      health: player.health,
      t: performance.now(),
    };
    this.socket.emit("state", snap);
  }

  private renderPeerShot(e: ShotEvent): void {
    this.fx ??= this.engine.getModule<FxSystem>("system.fx") ?? null;
    if (!this.fx) return;
    _from.set(e.origin[0], e.origin[1], e.origin[2]);
    _dir.set(e.dir[0], e.dir[1], e.dir[2]);
    _to.copy(_from).addScaledVector(_dir, PEER_TRACER_RANGE);
    const color = e.tracerColor ? Number(e.tracerColor) || DEFAULT_TRACER : DEFAULT_TRACER;
    this.fx.spawnTracer(_from, _to, color);
    this.fx.spawnMuzzleFlash(_from, color);
  }

  private respawn(): void {
    this.dead = false;
    usePlayerStore.getState().revive();
    useWeaponStore.getState().refillAmmo();
    // Spawn point with a small scatter so respawned players don't stack.
    playerRuntime.teleport = new THREE.Vector3(
      PLAYER_SPAWN.x + (Math.random() * 2 - 1) * 2,
      PLAYER_SPAWN.y,
      PLAYER_SPAWN.z + (Math.random() * 2 - 1) * 2,
    );
  }

  dispose(): void {
    this.unsubShot?.();
    this.unsubShot = null;
    for (const off of this.offs) off();
    this.offs.length = 0;
    clearPeers();
    this.fx = null;
  }
}
