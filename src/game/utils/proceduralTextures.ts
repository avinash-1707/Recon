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
