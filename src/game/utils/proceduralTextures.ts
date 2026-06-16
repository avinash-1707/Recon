import * as THREE from "three";

/**
 * Procedural CC0-free textures generated on a 2D canvas — no asset downloads,
 * deterministic enough, cheap. Client-only (needs `document`); guarded so any
 * accidental SSR import returns a blank texture instead of throwing.
 */

function canvas(size: number): { c: HTMLCanvasElement; ctx: CanvasRenderingContext2D } | null {
  if (typeof document === "undefined") return null;
  const c = document.createElement("canvas");
  c.width = c.height = size;
  const ctx = c.getContext("2d");
  if (!ctx) return null;
  return { c, ctx };
}

/** Tarmac-ish ground: dark base + speckle noise + faint grid seams. */
export function makeGroundTexture(): THREE.Texture {
  const made = canvas(512);
  if (!made) return new THREE.Texture();
  const { c, ctx } = made;
  const s = 512;

  ctx.fillStyle = "#23271f";
  ctx.fillRect(0, 0, s, s);

  // speckle
  for (let i = 0; i < 4000; i++) {
    const x = Math.random() * s;
    const y = Math.random() * s;
    const v = Math.random();
    ctx.fillStyle = v > 0.5 ? `rgba(255,255,255,${v * 0.05})` : `rgba(0,0,0,${v * 0.12})`;
    ctx.fillRect(x, y, 2, 2);
  }

  // grid seams
  ctx.strokeStyle = "rgba(0,0,0,0.30)";
  ctx.lineWidth = 3;
  const div = 4;
  const step = s / div;
  for (let i = 0; i <= div; i++) {
    ctx.beginPath();
    ctx.moveTo(i * step, 0);
    ctx.lineTo(i * step, s);
    ctx.stroke();
    ctx.beginPath();
    ctx.moveTo(0, i * step);
    ctx.lineTo(s, i * step);
    ctx.stroke();
  }

  const tex = new THREE.CanvasTexture(c);
  tex.wrapS = tex.wrapT = THREE.RepeatWrapping;
  tex.repeat.set(24, 24);
  tex.anisotropy = 4;
  tex.colorSpace = THREE.SRGBColorSpace;
  return tex;
}

/** Irregular dark-red blood splatter with a transparent falloff — for ground decals. */
export function makeBloodTexture(): THREE.Texture {
  const made = canvas(256);
  if (!made) return new THREE.Texture();
  const { c, ctx } = made;
  const s = 256;
  const cx = s / 2;
  const cy = s / 2;

  const grad = ctx.createRadialGradient(cx, cy, 4, cx, cy, s * 0.42);
  grad.addColorStop(0, "rgba(110,8,8,0.95)");
  grad.addColorStop(0.55, "rgba(85,5,5,0.8)");
  grad.addColorStop(1, "rgba(60,0,0,0)");
  ctx.fillStyle = grad;
  ctx.beginPath();
  ctx.arc(cx, cy, s * 0.42, 0, Math.PI * 2);
  ctx.fill();

  // splatter droplets
  ctx.fillStyle = "rgba(95,5,5,0.85)";
  for (let i = 0; i < 26; i++) {
    const a = Math.random() * Math.PI * 2;
    const r = s * (0.18 + Math.random() * 0.28);
    const rad = 2 + Math.random() * 7;
    ctx.beginPath();
    ctx.arc(cx + Math.cos(a) * r, cy + Math.sin(a) * r, rad, 0, Math.PI * 2);
    ctx.fill();
  }

  const tex = new THREE.CanvasTexture(c);
  tex.colorSpace = THREE.SRGBColorSpace;
  return tex;
}
