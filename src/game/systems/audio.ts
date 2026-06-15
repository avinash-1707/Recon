import type { GameContext, GameModule } from "@/game/core/types";
import { SystemOrder } from "@/game/core/types";
import { WeaponType } from "@/game/weapons/types";

interface ShotProfile {
  noiseFreq: number;
  noiseQ: number;
  dur: number;
  bodyFreq: number;
  vol: number;
  bodyVol: number;
}

const SHOTS: Readonly<Record<WeaponType, ShotProfile>> = {
  [WeaponType.Pistol]: { noiseFreq: 1500, noiseQ: 0.7, dur: 0.14, bodyFreq: 150, vol: 0.5, bodyVol: 0.4 },
  [WeaponType.AR]: { noiseFreq: 1850, noiseQ: 0.8, dur: 0.11, bodyFreq: 135, vol: 0.45, bodyVol: 0.35 },
  [WeaponType.Sniper]: { noiseFreq: 850, noiseQ: 0.6, dur: 0.5, bodyFreq: 85, vol: 0.7, bodyVol: 0.6 },
};

/**
 * Procedural Web Audio gun SFX — synthesized (noise burst through a bandpass +
 * a low sine "body"), so there are no asset downloads and every weapon has a
 * distinct report. Asset-ready: swap the synth calls for decoded sample buffers
 * later without touching callers. The context is created suspended and resumed
 * on first play (after the pointer-lock click satisfies the autoplay gesture).
 */
export class AudioSystem implements GameModule {
  readonly id = "system.audio";
  readonly order = SystemOrder.Entity;

  private ctx: AudioContext | null = null;
  private master: GainNode | null = null;
  private noise: AudioBuffer | null = null;

  init(_ctx: GameContext): void {
    if (typeof window === "undefined") return;
    const Ctor = window.AudioContext ?? (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
    if (!Ctor) return;
    this.ctx = new Ctor();
    this.master = this.ctx.createGain();
    this.master.gain.value = 0.6;
    this.master.connect(this.ctx.destination);

    // 1s white-noise buffer, reused by every shot/click source.
    const len = Math.floor(this.ctx.sampleRate);
    this.noise = this.ctx.createBuffer(1, len, this.ctx.sampleRate);
    const data = this.noise.getChannelData(0);
    for (let i = 0; i < len; i++) data[i] = Math.random() * 2 - 1;
  }

  private resume(): boolean {
    if (!this.ctx || !this.master || !this.noise) return false;
    if (this.ctx.state === "suspended") void this.ctx.resume();
    return true;
  }

  playShot(type: WeaponType): void {
    if (!this.resume()) return;
    const ctx = this.ctx!;
    const p = SHOTS[type];
    const t = ctx.currentTime;

    // noise crack
    const src = ctx.createBufferSource();
    src.buffer = this.noise;
    const bp = ctx.createBiquadFilter();
    bp.type = "bandpass";
    bp.frequency.value = p.noiseFreq;
    bp.Q.value = p.noiseQ;
    const hp = ctx.createBiquadFilter();
    hp.type = "highpass";
    hp.frequency.value = 320;
    const g = ctx.createGain();
    g.gain.setValueAtTime(0, t);
    g.gain.linearRampToValueAtTime(p.vol, t + 0.002);
    g.gain.exponentialRampToValueAtTime(0.001, t + p.dur);
    src.connect(bp).connect(hp).connect(g).connect(this.master!);
    src.start(t);
    src.stop(t + p.dur + 0.02);

    // low body thump
    const osc = ctx.createOscillator();
    osc.type = "sine";
    osc.frequency.setValueAtTime(p.bodyFreq, t);
    osc.frequency.exponentialRampToValueAtTime(40, t + p.dur * 0.6);
    const og = ctx.createGain();
    og.gain.setValueAtTime(p.bodyVol, t);
    og.gain.exponentialRampToValueAtTime(0.001, t + p.dur * 0.7);
    osc.connect(og).connect(this.master!);
    osc.start(t);
    osc.stop(t + p.dur * 0.8 + 0.02);
  }

  /** Mechanical clicks scheduled across the reload duration (mag out → in → charge). */
  playReload(durationMs: number): void {
    if (!this.resume()) return;
    const d = durationMs / 1000;
    this.click(0, 1200, 0.25);
    this.click(d * 0.45, 900, 0.22);
    this.click(d * 0.92, 1600, 0.3);
  }

  playDryFire(): void {
    if (!this.resume()) return;
    this.click(0, 2200, 0.18, 0.03);
  }

  playSwitch(): void {
    if (!this.resume()) return;
    this.click(0, 1400, 0.18, 0.04);
  }

  private click(delay: number, freq: number, vol: number, len = 0.05): void {
    const ctx = this.ctx!;
    const t = ctx.currentTime + delay;
    const src = ctx.createBufferSource();
    src.buffer = this.noise;
    const bp = ctx.createBiquadFilter();
    bp.type = "bandpass";
    bp.frequency.value = freq;
    bp.Q.value = 1.2;
    const g = ctx.createGain();
    g.gain.setValueAtTime(0, t);
    g.gain.linearRampToValueAtTime(vol, t + 0.001);
    g.gain.exponentialRampToValueAtTime(0.001, t + len);
    src.connect(bp).connect(g).connect(this.master!);
    src.start(t);
    src.stop(t + len + 0.02);
  }

  update(): void {
    // event-driven; nothing per frame
  }

  dispose(): void {
    void this.ctx?.close();
    this.ctx = null;
    this.master = null;
    this.noise = null;
  }
}
