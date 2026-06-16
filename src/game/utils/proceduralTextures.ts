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

function tile(tex: THREE.Texture, rx: number, ry: number): THREE.Texture {
  tex.wrapS = tex.wrapT = THREE.RepeatWrapping;
  tex.repeat.set(rx, ry);
  tex.colorSpace = THREE.SRGBColorSpace;
  tex.anisotropy = 4;
  return tex;
}

/** Plaster: warm base + fine speckle noise + a few hairline cracks. */
export function makePlasterTexture(): THREE.Texture {
  const made = canvas(256);
  if (!made) return new THREE.Texture();
  const { c, ctx } = made;
  const s = 256;
  ctx.fillStyle = "#cdc4ab";
  ctx.fillRect(0, 0, s, s);
  for (let i = 0; i < 6000; i++) {
    const v = Math.random();
    ctx.fillStyle = v > 0.5 ? `rgba(255,255,255,${v * 0.06})` : `rgba(60,50,35,${v * 0.08})`;
    ctx.fillRect(Math.random() * s, Math.random() * s, 2, 2);
  }
  ctx.strokeStyle = "rgba(80,70,55,0.25)";
  ctx.lineWidth = 1;
  for (let i = 0; i < 5; i++) {
    ctx.beginPath();
    let x = Math.random() * s;
    let y = Math.random() * s;
    ctx.moveTo(x, y);
    for (let j = 0; j < 6; j++) {
      x += (Math.random() - 0.5) * 40;
      y += Math.random() * 30;
      ctx.lineTo(x, y);
    }
    ctx.stroke();
  }
  return tile(new THREE.CanvasTexture(c), 2, 2);
}

/** Roof shingles: staggered horizontal rows with tonal variation. */
export function makeRoofTexture(): THREE.Texture {
  const made = canvas(256);
  if (!made) return new THREE.Texture();
  const { c, ctx } = made;
  const s = 256;
  ctx.fillStyle = "#5a2f28";
  ctx.fillRect(0, 0, s, s);
  const rows = 10;
  const rh = s / rows;
  for (let r = 0; r < rows; r++) {
    const offset = (r % 2) * (rh * 0.6);
    for (let x = -rh; x < s; x += rh * 1.2) {
      const shade = 0.75 + Math.random() * 0.35;
      ctx.fillStyle = `rgb(${Math.floor(0x6a * shade)},${Math.floor(0x36 * shade)},${Math.floor(0x2c * shade)})`;
      ctx.fillRect(x + offset, r * rh, rh * 1.1, rh * 0.9);
      ctx.strokeStyle = "rgba(0,0,0,0.3)";
      ctx.strokeRect(x + offset, r * rh, rh * 1.1, rh * 0.9);
    }
  }
  return tile(new THREE.CanvasTexture(c), 3, 3);
}

/** Brick course pattern for plinths/bases. */
export function makeBrickTexture(): THREE.Texture {
  const made = canvas(256);
  if (!made) return new THREE.Texture();
  const { c, ctx } = made;
  const s = 256;
  ctx.fillStyle = "#3a342d";
  ctx.fillRect(0, 0, s, s);
  const rows = 8;
  const bh = s / rows;
  const bw = s / 4;
  for (let r = 0; r < rows; r++) {
    const offset = (r % 2) * (bw / 2);
    for (let x = -bw; x < s; x += bw) {
      const shade = 0.8 + Math.random() * 0.25;
      ctx.fillStyle = `rgb(${Math.floor(0x6b * shade)},${Math.floor(0x60 * shade)},${Math.floor(0x55 * shade)})`;
      ctx.fillRect(x + offset + 1, r * bh + 1, bw - 2, bh - 2);
    }
  }
  return tile(new THREE.CanvasTexture(c), 3, 2);
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
