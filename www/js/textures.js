// textures.js — Procedural 2048x2048 (2K) texture generation.
// Everything is generated at runtime on a <canvas>, so the game ships with
// zero binary art assets and still renders full 2K detail on device.
import * as THREE from "three";

export const TEX_SIZE = 2048;

// ---------------------------------------------------------------------------
// Tiny deterministic value-noise helpers (tileable on a 256 lattice).
// ---------------------------------------------------------------------------
function makePerm(seed) {
  const p = new Uint8Array(512);
  const perm = new Uint8Array(256);
  for (let i = 0; i < 256; i++) perm[i] = i;
  // xorshift PRNG for deterministic layout
  let s = seed >>> 0 || 1;
  const rnd = () => {
    s ^= s << 13;
    s ^= s >>> 17;
    s ^= s << 5;
    return ((s >>> 0) % 1000) / 1000;
  };
  for (let i = 255; i > 0; i--) {
    const j = Math.floor(rnd() * (i + 1));
    const t = perm[i];
    perm[i] = perm[j];
    perm[j] = t;
  }
  for (let i = 0; i < 512; i++) p[i] = perm[i & 255];
  return p;
}

const fade = (t) => t * t * t * (t * (t * 6 - 15) + 10);
const lerp = (a, b, t) => a + (b - a) * t;

function grad2(hash, x, y) {
  switch (hash & 7) {
    case 0: return x + y;
    case 1: return x - y;
    case 2: return -x + y;
    case 3: return -x - y;
    case 4: return x;
    case 5: return -x;
    case 6: return y;
    default: return -y;
  }
}

// Classic 2D perlin, period = lattice size for tileable sampling.
function perlin2(p, x, y, period) {
  const xi = Math.floor(x) & 255;
  const yi = Math.floor(y) & 255;
  const xf = x - Math.floor(x);
  const yf = y - Math.floor(y);
  const u = fade(xf);
  const v = fade(yf);
  const wrap = (n) => ((n % period) + period) % period;
  const x0 = wrap(xi);
  const x1 = wrap(xi + 1);
  const y0 = wrap(yi);
  const y1 = wrap(yi + 1);
  const aa = p[p[x0] + y0];
  const ab = p[p[x0] + y1];
  const ba = p[p[x1] + y0];
  const bb = p[p[x1] + y1];
  const x1i = lerp(grad2(aa, xf, yf), grad2(ba, xf - 1, yf), u);
  const x2i = lerp(grad2(ab, xf, yf - 1), grad2(bb, xf - 1, yf - 1), u);
  return lerp(x1i, x2i, v); // ~[-1,1]
}

// Fractal brownian motion over the tileable perlin.
function fbm(p, x, y, octaves, period) {
  let sum = 0;
  let amp = 0.5;
  let freq = 1;
  let norm = 0;
  for (let o = 0; o < octaves; o++) {
    sum += amp * perlin2(p, x * freq, y * freq, period * freq);
    norm += amp;
    amp *= 0.5;
    freq *= 2;
  }
  return sum / norm;
}

// ---------------------------------------------------------------------------
// Canvas plumbing
// ---------------------------------------------------------------------------
function makeCanvas(size) {
  const c = document.createElement("canvas");
  c.width = c.height = size;
  return c;
}

function toTexture(canvas, repeat = 1) {
  const tex = new THREE.CanvasTexture(canvas);
  tex.wrapS = tex.wrapT = THREE.RepeatWrapping;
  tex.repeat.set(repeat, repeat);
  tex.anisotropy = 4;
  tex.colorSpace = THREE.SRGBColorSpace;
  return tex;
}

// ---------------------------------------------------------------------------
// Grass / forest floor
// ---------------------------------------------------------------------------
export function makeGrassTexture(size = TEX_SIZE) {
  const c = makeCanvas(size);
  const ctx = c.getContext("2d");
  const img = ctx.createImageData(size, size);
  const d = img.data;
  const p = makePerm(1337);
  const inv = 1 / size;

  for (let y = 0; y < size; y++) {
    for (let x = 0; x < size; x++) {
      const nx = x * inv * 8;
      const ny = y * inv * 8;
      const n = fbm(p, nx, ny, 5, 8); // large mottling
      const fine = fbm(p, nx * 8, ny * 8, 2, 64); // fine grain
      const shade = 0.5 + 0.5 * n;
      const grain = (fine + 1) * 0.5;

      // base forest-green gradient
      let r = 60 + shade * 40 + grain * 20;
      let g = 120 + shade * 70 + grain * 30;
      let b = 55 + shade * 30 + grain * 15;

      // scattered blade speckles
      if (grain > 0.82) {
        r += 20;
        g += 35;
      }
      const i = (y * size + x) * 4;
      d[i] = r;
      d[i + 1] = g;
      d[i + 2] = b;
      d[i + 3] = 255;
    }
  }
  ctx.putImageData(img, 0, 0);
  return toTexture(c, 1);
}

// ---------------------------------------------------------------------------
// Dirt path
// ---------------------------------------------------------------------------
export function makeDirtTexture(size = TEX_SIZE) {
  const c = makeCanvas(size);
  const ctx = c.getContext("2d");
  const img = ctx.createImageData(size, size);
  const d = img.data;
  const p = makePerm(4242);
  const inv = 1 / size;
  for (let y = 0; y < size; y++) {
    for (let x = 0; x < size; x++) {
      const n = fbm(p, x * inv * 10, y * inv * 10, 5, 10);
      const fine = fbm(p, x * inv * 90, y * inv * 90, 2, 90);
      const s = 0.5 + 0.5 * n;
      const i = (y * size + x) * 4;
      d[i] = 95 + s * 45 + fine * 15;
      d[i + 1] = 70 + s * 35 + fine * 10;
      d[i + 2] = 45 + s * 22;
      d[i + 3] = 255;
    }
  }
  ctx.putImageData(img, 0, 0);
  return toTexture(c, 1);
}

// ---------------------------------------------------------------------------
// Fort stone (brick courses with mortar)
// ---------------------------------------------------------------------------
export function makeStoneTexture(size = TEX_SIZE) {
  const c = makeCanvas(size);
  const ctx = c.getContext("2d");
  const p = makePerm(9001);

  // mortar background
  ctx.fillStyle = "#3a3a3e";
  ctx.fillRect(0, 0, size, size);

  const rows = 16; // brick courses
  const bricksPerRow = 8;
  const bh = size / rows;
  const bw = size / bricksPerRow;

  for (let r = 0; r < rows; r++) {
    const offset = (r % 2) * (bw / 2); // running bond
    for (let b = -1; b <= bricksPerRow; b++) {
      const bx = b * bw + offset;
      const by = r * bh;
      // per-brick colour variation
      const t = perlin2(p, b * 3.1, r * 2.7, 64);
      const base = 150 + t * 30;
      const pad = 3;
      ctx.fillStyle = `rgb(${base | 0},${(base - 6) | 0},${(base - 12) | 0})`;
      ctx.fillRect(bx + pad, by + pad, bw - pad * 2, bh - pad * 2);
      // top highlight
      ctx.fillStyle = "rgba(255,255,255,0.08)";
      ctx.fillRect(bx + pad, by + pad, bw - pad * 2, 3);
      // bottom shade
      ctx.fillStyle = "rgba(0,0,0,0.18)";
      ctx.fillRect(bx + pad, by + bh - pad - 3, bw - pad * 2, 3);
    }
  }

  // overlay noise for weathering
  const img = ctx.getImageData(0, 0, size, size);
  const d = img.data;
  const inv = 1 / size;
  for (let y = 0; y < size; y++) {
    for (let x = 0; x < size; x++) {
      const n = fbm(p, x * inv * 24, y * inv * 24, 3, 24) * 22;
      const i = (y * size + x) * 4;
      d[i] += n;
      d[i + 1] += n;
      d[i + 2] += n;
    }
  }
  ctx.putImageData(img, 0, 0);
  return toTexture(c, 1);
}

// ---------------------------------------------------------------------------
// Palace roof tiles (terracotta)
// ---------------------------------------------------------------------------
export function makeRoofTexture(size = TEX_SIZE) {
  const c = makeCanvas(size);
  const ctx = c.getContext("2d");
  const p = makePerm(777);
  ctx.fillStyle = "#5a2418";
  ctx.fillRect(0, 0, size, size);

  const rows = 20;
  const cols = 16;
  const th = size / rows;
  const tw = size / cols;
  for (let r = 0; r < rows; r++) {
    const offset = (r % 2) * (tw / 2);
    for (let col = -1; col <= cols; col++) {
      const x = col * tw + offset;
      const y = r * th;
      const t = perlin2(p, col * 1.7, r * 2.3, 32);
      const base = 150 + t * 35;
      // rounded tile shading
      const grad = ctx.createLinearGradient(x, y, x, y + th);
      grad.addColorStop(0, `rgb(${base | 0},${(base * 0.45) | 0},${(base * 0.32) | 0})`);
      grad.addColorStop(1, `rgb(${(base * 0.6) | 0},${(base * 0.24) | 0},${(base * 0.16) | 0})`);
      ctx.fillStyle = grad;
      ctx.beginPath();
      ctx.roundRect(x + 1, y + 1, tw - 2, th - 2, [tw * 0.4, tw * 0.4, 4, 4]);
      ctx.fill();
    }
  }
  return toTexture(c, 1);
}

// ---------------------------------------------------------------------------
// Wood planks (doors, beams)
// ---------------------------------------------------------------------------
export function makeWoodTexture(size = TEX_SIZE) {
  const c = makeCanvas(size);
  const ctx = c.getContext("2d");
  const p = makePerm(31415);
  const planks = 8;
  const pw = size / planks;
  for (let i = 0; i < planks; i++) {
    const t = perlin2(p, i * 2.2, 0.5, 16);
    const base = 110 + t * 30;
    ctx.fillStyle = `rgb(${base | 0},${(base * 0.62) | 0},${(base * 0.35) | 0})`;
    ctx.fillRect(i * pw, 0, pw, size);
    // grain lines
    ctx.strokeStyle = "rgba(60,35,15,0.35)";
    ctx.lineWidth = 1;
    for (let g = 0; g < 6; g++) {
      const gx = i * pw + (g + 0.5) * (pw / 6);
      ctx.beginPath();
      ctx.moveTo(gx, 0);
      for (let y = 0; y <= size; y += 32) {
        ctx.lineTo(gx + Math.sin(y * 0.02 + i) * 3, y);
      }
      ctx.stroke();
    }
    // plank gap
    ctx.fillStyle = "rgba(0,0,0,0.4)";
    ctx.fillRect(i * pw, 0, 2, size);
  }
  return toTexture(c, 1);
}

// ---------------------------------------------------------------------------
// Bark (tree trunks)
// ---------------------------------------------------------------------------
export function makeBarkTexture(size = 512) {
  const c = makeCanvas(size);
  const ctx = c.getContext("2d");
  const p = makePerm(2718);
  const img = ctx.createImageData(size, size);
  const d = img.data;
  const inv = 1 / size;
  for (let y = 0; y < size; y++) {
    for (let x = 0; x < size; x++) {
      const n = fbm(p, x * inv * 12, y * inv * 3, 4, 12);
      const s = 0.5 + 0.5 * n;
      const i = (y * size + x) * 4;
      d[i] = 70 + s * 40;
      d[i + 1] = 48 + s * 28;
      d[i + 2] = 30 + s * 18;
      d[i + 3] = 255;
    }
  }
  ctx.putImageData(img, 0, 0);
  return toTexture(c, 1);
}