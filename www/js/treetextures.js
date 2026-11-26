// treetextures.js — Realistic vegetation textures (RGBA, alpha-cutout).
// Produces photographic-style tree billboards (trunk + leaf clusters), bark,
// and grass/fern tufts. Everything is drawn procedurally so the game stays
// self-contained and works offline, but the result reads as a real forest
// rather than low-poly cones.
import * as THREE from "three";

function rng(seed) {
  let s = seed >>> 0 || 1;
  return () => {
    s ^= s << 13;
    s ^= s >>> 17;
    s ^= s << 5;
    return ((s >>> 0) % 1000000) / 1000000;
  };
}

function canvas2d(w, h) {
  const c = document.createElement("canvas");
  c.width = w;
  c.height = h;
  return { c, ctx: c.getContext("2d") };
}

function toTex(canvas, srgb = true) {
  const t = new THREE.CanvasTexture(canvas);
  t.colorSpace = srgb ? THREE.SRGBColorSpace : THREE.NoColorSpace;
  t.anisotropy = 4;
  t.needsUpdate = true;
  return t;
}

// ---------------------------------------------------------------------------
// Realistic tree billboard (RGBA). Draws a branching trunk then leaf clusters.
// opts: { size, seed, hue, sat, light, spread, leafDensity, conifer }
// ---------------------------------------------------------------------------
export function makeTreeTexture(opts = {}) {
  const size = opts.size || 1024;
  const R = rng(opts.seed || 1);
  const { c, ctx } = canvas2d(size, size);
  ctx.clearRect(0, 0, size, size);

  const hue = opts.hue ?? 110;
  const sat = opts.sat ?? 45;
  const light = opts.light ?? 32;
  const spread = opts.spread ?? 0.55;
  const density = opts.leafDensity ?? 1;

  const segs = [];
  const clusters = [];
  const up = -Math.PI / 2;

  function branch(x, y, ang, len, w, depth) {
    const x1 = x + Math.cos(ang) * len;
    const y1 = y + Math.sin(ang) * len;
    segs.push({ x0: x, y0: y, x1, y1, w0: w, w1: w * 0.72, depth });
    if (depth <= 0 || len < size * 0.02) {
      clusters.push({ x: x1, y: y1, r: len * (1.6 + R() * 1.2) });
      return;
    }
    // leaf clusters along the branch for a fuller canopy
    if (depth <= 3) {
      const t = 0.4 + R() * 0.5;
      clusters.push({
        x: x + (x1 - x) * t,
        y: y + (y1 - y) * t,
        r: len * (1.1 + R() * 0.9),
      });
    }
    const n = depth > 3 ? 2 : 2 + (R() < 0.35 ? 1 : 0);
    for (let i = 0; i < n; i++) {
      const frac = n === 1 ? 0 : i / (n - 1) - 0.5;
      const na = ang + frac * spread * 2 + (R() - 0.5) * 0.25;
      branch(x1, y1, na, len * (0.68 + R() * 0.12), w * 0.66, depth - 1);
    }
    // occasional central leader
    if (depth > 2 && R() < 0.6) {
      branch(x1, y1, ang + (R() - 0.5) * 0.3, len * 0.8, w * 0.7, depth - 1);
    }
  }

  const baseX = size * 0.5;
  const baseY = size * 0.985;
  branch(baseX, baseY, up, size * 0.2, size * 0.05, 6);

  // ---- draw trunk & branches (tapered, shaded) ----------------------------
  ctx.lineCap = "round";
  for (const s of segs) {
    const w = (s.w0 + s.w1) / 2;
    // dark base
    ctx.strokeStyle = "rgba(38,26,16,0.95)";
    ctx.lineWidth = w * 1.15;
    ctx.beginPath();
    ctx.moveTo(s.x0, s.y0);
    ctx.lineTo(s.x1, s.y1);
    ctx.stroke();
    // mid bark tone
    ctx.strokeStyle = `hsl(28, 30%, ${18 + s.depth * 1.5}%)`;
    ctx.lineWidth = w * 0.85;
    ctx.beginPath();
    ctx.moveTo(s.x0, s.y0);
    ctx.lineTo(s.x1, s.y1);
    ctx.stroke();
    // sunlit edge
    ctx.strokeStyle = "rgba(150,120,80,0.35)";
    ctx.lineWidth = Math.max(1, w * 0.25);
    ctx.beginPath();
    ctx.moveTo(s.x0 - w * 0.2, s.y0);
    ctx.lineTo(s.x1 - w * 0.2, s.y1);
    ctx.stroke();
  }

  // ---- draw leaf clusters -------------------------------------------------
  // sort back-to-front (higher on screen = further) for painter's depth
  clusters.sort((a, b) => a.y - b.y);
  for (const cl of clusters) {
    const n = Math.floor((26 + R() * 30) * density);
    for (let i = 0; i < n; i++) {
      const a = R() * Math.PI * 2;
      const rad = Math.sqrt(R()) * cl.r;
      const lx = cl.x + Math.cos(a) * rad;
      const ly = cl.y + Math.sin(a) * rad * 0.9;
      const lr = cl.r * (0.12 + R() * 0.16);
      // darker interior, brighter top-left (sun)
      const upness = 1 - ly / size;
      const l = light + upness * 10 + (R() - 0.5) * 12;
      const h = hue + (R() - 0.5) * 16;
      ctx.fillStyle = `hsla(${h}, ${sat}%, ${l}%, ${0.75 + R() * 0.25})`;
      ctx.beginPath();
      ctx.ellipse(lx, ly, lr, lr * (0.7 + R() * 0.5), a, 0, Math.PI * 2);
      ctx.fill();
    }
  }

  return toTex(c);
}

// ---------------------------------------------------------------------------
// Bark (colour + derived normal map) for hero trunks.
// ---------------------------------------------------------------------------
export function makeBark(size = 512) {
  const { c, ctx } = canvas2d(size, size);
  const R = rng(9271);
  ctx.fillStyle = "#4a3524";
  ctx.fillRect(0, 0, size, size);
  // vertical cracks
  for (let i = 0; i < 90; i++) {
    const x = R() * size;
    ctx.strokeStyle = `rgba(${20 + R() * 30},${14 + R() * 20},${8 + R() * 12},${0.4 + R() * 0.4})`;
    ctx.lineWidth = 1 + R() * 3;
    ctx.beginPath();
    ctx.moveTo(x, 0);
    for (let y = 0; y <= size; y += 24) ctx.lineTo(x + (R() - 0.5) * 10, y);
    ctx.stroke();
  }
  // highlights
  for (let i = 0; i < 60; i++) {
    const x = R() * size;
    ctx.strokeStyle = `rgba(150,120,85,${0.15 + R() * 0.2})`;
    ctx.lineWidth = 1 + R() * 2;
    ctx.beginPath();
    ctx.moveTo(x, 0);
    ctx.lineTo(x + (R() - 0.5) * 8, size);
    ctx.stroke();
  }
  const map = toTex(c);
  map.wrapS = map.wrapT = THREE.RepeatWrapping;
  return { map, normal: normalFromCanvas(c, 2.0) };
}

// Derive a tangent-space normal map from a canvas' luminance (Sobel).
function normalFromCanvas(src, strength) {
  const w = src.width;
  const h = src.height;
  const sctx = src.getContext("2d");
  const sd = sctx.getImageData(0, 0, w, h).data;
  const { c, ctx } = canvas2d(w, h);
  const out = ctx.createImageData(w, h);
  const lum = (x, y) => {
    x = (x + w) % w;
    y = (y + h) % h;
    const i = (y * w + x) * 4;
    return (sd[i] * 0.3 + sd[i + 1] * 0.59 + sd[i + 2] * 0.11) / 255;
  };
  for (let y = 0; y < h; y++) {
    for (let x = 0; x < w; x++) {
      const dx = (lum(x - 1, y) - lum(x + 1, y)) * strength;
      const dy = (lum(x, y - 1) - lum(x, y + 1)) * strength;
      const len = Math.hypot(dx, dy, 1);
      const i = (y * w + x) * 4;
      out.data[i] = ((dx / len) * 0.5 + 0.5) * 255;
      out.data[i + 1] = ((dy / len) * 0.5 + 0.5) * 255;
      out.data[i + 2] = (1 / len) * 255;
      out.data[i + 3] = 255;
    }
  }
  ctx.putImageData(out, 0, 0);
  const t = toTex(c, false);
  t.wrapS = t.wrapT = THREE.RepeatWrapping;
  return t;
}

// ---------------------------------------------------------------------------
// Grass / fern tuft (RGBA) for ground undergrowth.
// ---------------------------------------------------------------------------
export function makeGrassTuft(size = 256, seed = 5, fern = false) {
  const { c, ctx } = canvas2d(size, size);
  const R = rng(seed);
  ctx.clearRect(0, 0, size, size);
  const blades = fern ? 9 : 22;
  for (let i = 0; i < blades; i++) {
    const baseX = size * 0.5 + (R() - 0.5) * size * 0.3;
    const tipX = baseX + (R() - 0.5) * size * 0.6;
    const tipY = size * (fern ? 0.1 + R() * 0.3 : 0.05 + R() * 0.5);
    const w = fern ? 3 + R() * 3 : 2 + R() * 3;
    const g = ctx.createLinearGradient(0, size, 0, tipY);
    g.addColorStop(0, `hsl(${95 + R() * 20}, 45%, ${18 + R() * 8}%)`);
    g.addColorStop(1, `hsl(${90 + R() * 25}, 55%, ${34 + R() * 14}%)`);
    ctx.strokeStyle = g;
    ctx.lineWidth = w;
    ctx.lineCap = "round";
    ctx.beginPath();
    ctx.moveTo(baseX, size);
    ctx.quadraticCurveTo((baseX + tipX) / 2, size * 0.5, tipX, tipY);
    ctx.stroke();
    if (fern) {
      // leaflets
      for (let l = 0; l < 6; l++) {
        const t = 0.3 + l * 0.11;
        const px = baseX + (tipX - baseX) * t;
        const py = size + (tipY - size) * t;
        ctx.lineWidth = 2;
        ctx.beginPath();
        ctx.moveTo(px, py);
        ctx.lineTo(px + (R() - 0.5) * 40, py - 10 - R() * 10);
        ctx.stroke();
      }
    }
  }
  return toTex(c);
}