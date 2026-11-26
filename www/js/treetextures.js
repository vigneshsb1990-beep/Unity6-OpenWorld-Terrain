// treetextures.js — Full realistic vegetation library (RGBA, alpha-cutout).
// Every plant is drawn procedurally (self-contained, offline) but reads as a
// real forest: many tree species + shrubs, ferns, flowers and grasses.
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
  c.height = h || w;
  return { c, ctx: c.getContext("2d") };
}
function toTex(canvas, srgb = true) {
  const t = new THREE.CanvasTexture(canvas);
  t.colorSpace = srgb ? THREE.SRGBColorSpace : THREE.NoColorSpace;
  t.anisotropy = 4;
  t.needsUpdate = true;
  return t;
}

// A soft leaf cluster: many small ellipses, darker inside, sunlit on top.
function leafCluster(ctx, x, y, r, R, o) {
  const n = Math.floor((o.n || 30) * (o.density || 1));
  for (let i = 0; i < n; i++) {
    const a = R() * Math.PI * 2;
    const rad = Math.sqrt(R()) * r;
    const lx = x + Math.cos(a) * rad;
    const ly = y + Math.sin(a) * rad * 0.9;
    const lr = r * (0.12 + R() * 0.16) * (o.leafScale || 1);
    const upness = 1 - ly / o.size;
    const l = o.light + upness * 10 + (R() - 0.5) * 12;
    const h = o.hue + (R() - 0.5) * 16;
    ctx.fillStyle = `hsla(${h}, ${o.sat}%, ${l}%, ${0.75 + R() * 0.25})`;
    ctx.beginPath();
    ctx.ellipse(lx, ly, lr, lr * (0.7 + R() * 0.5), a, 0, Math.PI * 2);
    ctx.fill();
  }
}

// Recursive branching skeleton. Returns { segs, tips }.
function skeleton(size, R, o) {
  const segs = [];
  const tips = [];
  const up = -Math.PI / 2;
  const depthMax = o.depth ?? 6;
  function br(x, y, ang, len, w, depth) {
    const droop = (o.droop || 0) * (depthMax - depth);
    const x1 = x + Math.cos(ang) * len;
    const y1 = y + Math.sin(ang) * len + droop * len;
    segs.push({ x0: x, y0: y, x1, y1, w0: w, w1: w * 0.72, depth });
    if (depth <= 0 || len < size * 0.02) {
      tips.push({ x: x1, y: y1, len });
      return;
    }
    if (depth <= 3) {
      const t = 0.4 + R() * 0.5;
      tips.push({ x: x + (x1 - x) * t, y: y + (y1 - y) * t + droop * len * t, len: len * 0.7 });
    }
    const n = depth > 3 ? 2 : 2 + (R() < 0.35 ? 1 : 0);
    for (let i = 0; i < n; i++) {
      const frac = n === 1 ? 0 : i / (n - 1) - 0.5;
      const na = ang + frac * (o.spread ?? 0.55) * 2 + (R() - 0.5) * 0.25;
      br(x1, y1, na, len * (0.68 + R() * 0.12), w * 0.66, depth - 1);
    }
    if (depth > 2 && R() < 0.6)
      br(x1, y1, ang + (R() - 0.5) * 0.3, len * 0.8, w * 0.7, depth - 1);
  }
  br(size * 0.5, size * 0.985, up, (o.len0 ?? 0.2) * size, (o.w0 ?? 0.05) * size, depthMax);
  return { segs, tips };
}

function drawTrunk(ctx, segs, bark) {
  ctx.lineCap = "round";
  for (const s of segs) {
    const w = (s.w0 + s.w1) / 2;
    const shade = bark === "white" ? 78 : bark === "gray" ? 40 : 20;
    ctx.strokeStyle = bark === "white" ? "rgba(40,40,45,0.9)" : "rgba(30,20,12,0.95)";
    ctx.lineWidth = w * 1.15;
    ctx.beginPath();
    ctx.moveTo(s.x0, s.y0);
    ctx.lineTo(s.x1, s.y1);
    ctx.stroke();
    ctx.strokeStyle =
      bark === "white"
        ? `hsl(40, 12%, ${shade + s.depth}%)`
        : bark === "gray"
        ? `hsl(30, 8%, ${shade + s.depth * 1.2}%)`
        : `hsl(28, 30%, ${shade + s.depth * 1.5}%)`;
    ctx.lineWidth = w * 0.85;
    ctx.beginPath();
    ctx.moveTo(s.x0, s.y0);
    ctx.lineTo(s.x1, s.y1);
    ctx.stroke();
    if (bark === "white") {
      // birch lenticels
      ctx.strokeStyle = "rgba(30,30,30,0.55)";
      ctx.lineWidth = Math.max(1, w * 0.18);
      ctx.beginPath();
      ctx.moveTo(s.x0 - w * 0.3, s.y0);
      ctx.lineTo(s.x0 + w * 0.3, s.y0);
      ctx.stroke();
    }
  }
}

// ---------------------------------------------------------------------------
// Broadleaf (oak / maple / poplar). opts.bark: brown|white|gray
// ---------------------------------------------------------------------------
export function makeTreeTexture(opts = {}) {
  const size = opts.size || 1024;
  const R = rng(opts.seed || 1);
  const { c, ctx } = canvas2d(size);
  const o = {
    size,
    hue: opts.hue ?? 110,
    sat: opts.sat ?? 45,
    light: opts.light ?? 32,
    leafScale: opts.leafScale ?? 1,
    density: opts.density ?? 1,
    n: opts.n ?? 30,
  };
  const sk = skeleton(size, R, {
    spread: opts.spread ?? 0.55,
    depth: opts.depth ?? 6,
    len0: opts.len0 ?? 0.2,
    w0: opts.w0 ?? 0.05,
    droop: opts.droop ?? 0,
  });
  drawTrunk(ctx, sk.segs, opts.bark || "brown");
  sk.tips.sort((a, b) => a.y - b.y);
  const rBase = (opts.cluster ?? 0.06) * size * (opts.len0 ? opts.len0 / 0.2 : 1);
  for (const t of sk.tips) leafCluster(ctx, t.x, t.y, Math.max(6, t.len * 1.6), R, o);
  return toTex(c);
}

// Tall narrow poplar: same skeleton, stretched canopy.
export function makePoplarTexture(opts = {}) {
  return makeTreeTexture({
    seed: opts.seed || 71,
    hue: 100,
    sat: 40,
    light: 30,
    spread: 0.35,
    depth: 6,
    len0: 0.26,
    w0: 0.04,
    leafScale: 0.8,
    density: 1.3,
    bark: "gray",
    ...opts,
  });
}

// ---------------------------------------------------------------------------
// Conifer (pine / spruce): layered needle whorls, conical silhouette.
// ---------------------------------------------------------------------------
export function makeConiferTexture(opts = {}) {
  const size = opts.size || 1024;
  const R = rng(opts.seed || 3);
  const { c, ctx } = canvas2d(size);
  const baseX = size * 0.5;
  const baseY = size * 0.985;
  const trunkH = size * 0.92;
  const hue = opts.hue ?? 135;
  const sat = opts.sat ?? 40;
  const light = opts.light ?? 22;

  // trunk
  ctx.strokeStyle = "rgba(35,24,15,0.95)";
  ctx.lineWidth = size * 0.03;
  ctx.lineCap = "round";
  ctx.beginPath();
  ctx.moveTo(baseX, baseY);
  ctx.lineTo(baseX, baseY - trunkH);
  ctx.stroke();

  const whorls = 16;
  for (let w = 0; w < whorls; w++) {
    const t = w / (whorls - 1); // 0 bottom .. 1 top
    const y = baseY - trunkH * t;
    const maxLen = size * 0.4 * Math.pow(1 - t, 0.85) + size * 0.02;
    const branches = 6;
    for (let b = 0; b < branches; b++) {
      const ang = (b / branches) * Math.PI * 2 + R() * 0.4;
      const len = maxLen * (0.7 + R() * 0.5);
      const ex = baseX + Math.cos(ang) * len;
      const ey = y + Math.sin(ang) * len * 0.25 + len * 0.12; // slight droop
      // woody branch
      ctx.strokeStyle = "rgba(40,28,18,0.8)";
      ctx.lineWidth = Math.max(1, size * 0.006 * (1 - t));
      ctx.beginPath();
      ctx.moveTo(baseX, y);
      ctx.lineTo(ex, ey);
      ctx.stroke();
      // needle sprays along the branch
      const sprays = Math.floor(len / (size * 0.02));
      for (let s = 0; s < sprays; s++) {
        const tt = s / sprays;
        const px = baseX + (ex - baseX) * tt;
        const py = y + (ey - y) * tt;
        const nl = size * 0.03 * (1 - t * 0.5);
        for (let k = 0; k < 5; k++) {
          const na = ang + (R() - 0.5) * 1.2;
          ctx.strokeStyle = `hsla(${hue + (R() - 0.5) * 14}, ${sat}%, ${light + R() * 12}%, 0.9)`;
          ctx.lineWidth = Math.max(1, size * 0.0035);
          ctx.beginPath();
          ctx.moveTo(px, py);
          ctx.lineTo(px + Math.cos(na) * nl, py + Math.sin(na) * nl * 0.6 - nl * 0.3);
          ctx.stroke();
        }
      }
    }
  }
  // leader spike
  ctx.strokeStyle = `hsl(${hue}, ${sat}%, ${light + 8}%)`;
  ctx.lineWidth = size * 0.006;
  ctx.beginPath();
  ctx.moveTo(baseX, baseY - trunkH);
  ctx.lineTo(baseX, baseY - trunkH - size * 0.05);
  ctx.stroke();
  return toTex(c);
}

// ---------------------------------------------------------------------------
// Willow: arching branches with hanging leaf strands.
// ---------------------------------------------------------------------------
export function makeWillowTexture(opts = {}) {
  const size = opts.size || 1024;
  const R = rng(opts.seed || 55);
  const { c, ctx } = canvas2d(size);
  const sk = skeleton(size, R, { spread: 0.7, depth: 5, len0: 0.18, w0: 0.05, droop: 0.05 });
  drawTrunk(ctx, sk.segs, "brown");
  const o = { size, hue: 95, sat: 45, light: 30, density: 1 };
  // hanging strands from tips
  for (const t of sk.tips) {
    const strands = 3 + Math.floor(R() * 3);
    for (let s = 0; s < strands; s++) {
      let x = t.x + (R() - 0.5) * 20;
      let y = t.y;
      const len = size * (0.15 + R() * 0.2);
      const sway = (R() - 0.5) * 30;
      ctx.strokeStyle = "rgba(60,80,30,0.5)";
      ctx.lineWidth = 1.5;
      ctx.beginPath();
      ctx.moveTo(x, y);
      ctx.quadraticCurveTo(x + sway, y + len * 0.5, x + sway * 0.5, y + len);
      ctx.stroke();
      for (let l = 0; l < len; l += size * 0.012) {
        const tt = l / len;
        const lx = x + sway * tt;
        const ly = y + l;
        leafCluster(ctx, lx, ly, size * 0.012, R, { ...o, n: 4 });
      }
    }
  }
  return toTex(c);
}

// ---------------------------------------------------------------------------
// Dead / bare tree: no leaves, weathered branches.
// ---------------------------------------------------------------------------
export function makeDeadTreeTexture(opts = {}) {
  const size = opts.size || 1024;
  const R = rng(opts.seed || 88);
  const { c, ctx } = canvas2d(size);
  const sk = skeleton(size, R, { spread: 0.6, depth: 6, len0: 0.22, w0: 0.055 });
  drawTrunk(ctx, sk.segs, "gray");
  // a few broken stubs
  ctx.strokeStyle = "rgba(40,30,22,0.9)";
  for (const t of sk.tips) {
    if (R() < 0.3) {
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.moveTo(t.x, t.y);
      ctx.lineTo(t.x + (R() - 0.5) * 20, t.y - R() * 20);
      ctx.stroke();
    }
  }
  return toTex(c);
}

// ---------------------------------------------------------------------------
// Palm: curved ringed trunk + feathered fronds.
// ---------------------------------------------------------------------------
export function makePalmTexture(opts = {}) {
  const size = opts.size || 1024;
  const R = rng(opts.seed || 123);
  const { c, ctx } = canvas2d(size);
  const baseX = size * 0.5;
  const baseY = size * 0.985;
  const topX = baseX + (R() - 0.5) * size * 0.15;
  const topY = size * 0.28;
  // curved tapered trunk
  ctx.lineCap = "round";
  const steps = 24;
  for (let i = 0; i < steps; i++) {
    const t0 = i / steps;
    const t1 = (i + 1) / steps;
    const p0 = palmPt(baseX, baseY, topX, topY, t0);
    const p1 = palmPt(baseX, baseY, topX, topY, t1);
    ctx.strokeStyle = i % 2 ? "#6b5236" : "#7a5f3f";
    ctx.lineWidth = size * 0.05 * (1 - t0 * 0.5);
    ctx.beginPath();
    ctx.moveTo(p0.x, p0.y);
    ctx.lineTo(p1.x, p1.y);
    ctx.stroke();
  }
  // fronds
  const fronds = 9;
  for (let f = 0; f < fronds; f++) {
    const ang = -Math.PI / 2 + (f / (fronds - 1) - 0.5) * Math.PI * 1.4;
    const len = size * (0.28 + R() * 0.12);
    const ex = topX + Math.cos(ang) * len;
    const ey = topY + Math.sin(ang) * len * 0.7 + len * 0.3;
    ctx.strokeStyle = `hsl(${100 + R() * 20}, 45%, ${28 + R() * 10}%)`;
    ctx.lineWidth = size * 0.006;
    ctx.beginPath();
    ctx.moveTo(topX, topY);
    ctx.quadraticCurveTo((topX + ex) / 2, (topY + ey) / 2 - len * 0.2, ex, ey);
    ctx.stroke();
    // leaflets
    const n = 16;
    for (let i = 1; i < n; i++) {
      const tt = i / n;
      const px = topX + (ex - topX) * tt;
      const py = topY + (ey - topY) * tt - Math.sin(tt * Math.PI) * len * 0.2;
      const ll = size * 0.03 * (1 - tt * 0.4);
      for (const s of [-1, 1]) {
        ctx.strokeStyle = `hsla(${100 + R() * 20}, 50%, ${30 + R() * 12}%, 0.9)`;
        ctx.lineWidth = size * 0.004;
        ctx.beginPath();
        ctx.moveTo(px, py);
        ctx.lineTo(px + Math.cos(ang + s * 1.1) * ll, py + Math.sin(ang + s * 1.1) * ll * 0.6 + ll * 0.4);
        ctx.stroke();
      }
    }
  }
  return toTex(c);
}
function palmPt(x0, y0, x1, y1, t) {
  // quadratic-ish bow
  const x = x0 + (x1 - x0) * t + Math.sin(t * Math.PI) * (x1 - x0) * 0.4;
  const y = y0 + (y1 - y0) * t;
  return { x, y };
}

// ---------------------------------------------------------------------------
// Bush / shrub: low dense mound (no tall trunk).
// ---------------------------------------------------------------------------
export function makeBushTexture(opts = {}) {
  const size = opts.size || 512;
  const R = rng(opts.seed || 202);
  const { c, ctx } = canvas2d(size);
  const o = {
    size,
    hue: opts.hue ?? 105,
    sat: opts.sat ?? 45,
    light: opts.light ?? 26,
    density: 1.2,
    n: 26,
    leafScale: 0.9,
  };
  const clumps = 14;
  for (let i = 0; i < clumps; i++) {
    const x = size * (0.2 + R() * 0.6);
    const y = size * (0.45 + R() * 0.4);
    leafCluster(ctx, x, y, size * (0.08 + R() * 0.08), R, o);
  }
  // a few woody stems at the base
  ctx.strokeStyle = "rgba(50,35,20,0.8)";
  ctx.lineWidth = size * 0.01;
  for (let i = 0; i < 5; i++) {
    ctx.beginPath();
    ctx.moveTo(size * 0.5, size);
    ctx.lineTo(size * (0.3 + R() * 0.4), size * (0.5 + R() * 0.2));
    ctx.stroke();
  }
  return toTex(c);
}

// ---------------------------------------------------------------------------
// Flower patch: stems + coloured blossoms.
// ---------------------------------------------------------------------------
export function makeFlowerTexture(opts = {}) {
  const size = opts.size || 256;
  const R = rng(opts.seed || 303);
  const { c, ctx } = canvas2d(size);
  const palette = opts.palette || [0, 50, 280, 330]; // hues: white/yellow/violet/pink
  const n = 10 + Math.floor(R() * 8);
  for (let i = 0; i < n; i++) {
    const bx = size * (0.15 + R() * 0.7);
    const h = size * (0.3 + R() * 0.5);
    ctx.strokeStyle = `hsl(100, 45%, ${25 + R() * 10}%)`;
    ctx.lineWidth = size * 0.012;
    ctx.beginPath();
    ctx.moveTo(bx, size);
    ctx.quadraticCurveTo(bx + (R() - 0.5) * 20, size - h * 0.5, bx + (R() - 0.5) * 30, size - h);
    ctx.stroke();
    const hue = palette[Math.floor(R() * palette.length)];
    const fx = bx + (R() - 0.5) * 30;
    const fy = size - h;
    const pr = size * (0.03 + R() * 0.02);
    for (let p = 0; p < 5; p++) {
      const a = (p / 5) * Math.PI * 2;
      ctx.fillStyle = `hsl(${hue}, 70%, ${60 + R() * 15}%)`;
      ctx.beginPath();
      ctx.ellipse(fx + Math.cos(a) * pr, fy + Math.sin(a) * pr, pr * 0.8, pr * 0.8, a, 0, Math.PI * 2);
      ctx.fill();
    }
    ctx.fillStyle = "hsl(45, 90%, 55%)";
    ctx.beginPath();
    ctx.arc(fx, fy, pr * 0.5, 0, Math.PI * 2);
    ctx.fill();
  }
  return toTex(c);
}

// ---------------------------------------------------------------------------
// Tall grass / reeds.
// ---------------------------------------------------------------------------
export function makeTallGrassTexture(opts = {}) {
  const size = opts.size || 256;
  const R = rng(opts.seed || 404);
  const { c, ctx } = canvas2d(size);
  const blades = 26;
  for (let i = 0; i < blades; i++) {
    const baseX = size * 0.5 + (R() - 0.5) * size * 0.5;
    const tipX = baseX + (R() - 0.5) * size * 0.5;
    const tipY = size * (0.02 + R() * 0.35);
    const g = ctx.createLinearGradient(0, size, 0, tipY);
    g.addColorStop(0, `hsl(${90 + R() * 20}, 45%, ${16 + R() * 8}%)`);
    g.addColorStop(1, `hsl(${80 + R() * 25}, 55%, ${36 + R() * 14}%)`);
    ctx.strokeStyle = g;
    ctx.lineWidth = size * (0.008 + R() * 0.01);
    ctx.lineCap = "round";
    ctx.beginPath();
    ctx.moveTo(baseX, size);
    ctx.quadraticCurveTo((baseX + tipX) / 2, size * 0.4, tipX, tipY);
    ctx.stroke();
    if (R() < 0.3) {
      // seed head
      ctx.fillStyle = "hsl(45, 30%, 40%)";
      ctx.beginPath();
      ctx.ellipse(tipX, tipY, size * 0.012, size * 0.03, 0, 0, Math.PI * 2);
      ctx.fill();
    }
  }
  return toTex(c);
}

// ---------------------------------------------------------------------------
// Grass tuft (short) + fern (kept for compatibility).
// ---------------------------------------------------------------------------
export function makeGrassTuft(size = 256, seed = 5, fern = false) {
  const { c, ctx } = canvas2d(size);
  const R = rng(seed);
  const blades = fern ? 9 : 22;
  for (let i = 0; i < blades; i++) {
    const baseX = size * 0.5 + (R() - 0.5) * size * 0.3;
    const tipX = baseX + (R() - 0.5) * size * 0.6;
    const tipY = size * (fern ? 0.1 + R() * 0.3 : 0.05 + R() * 0.5);
    const g = ctx.createLinearGradient(0, size, 0, tipY);
    g.addColorStop(0, `hsl(${95 + R() * 20}, 45%, ${18 + R() * 8}%)`);
    g.addColorStop(1, `hsl(${90 + R() * 25}, 55%, ${34 + R() * 14}%)`);
    ctx.strokeStyle = g;
    ctx.lineWidth = fern ? 3 + R() * 3 : 2 + R() * 3;
    ctx.lineCap = "round";
    ctx.beginPath();
    ctx.moveTo(baseX, size);
    ctx.quadraticCurveTo((baseX + tipX) / 2, size * 0.5, tipX, tipY);
    ctx.stroke();
    if (fern) {
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

// ---------------------------------------------------------------------------
// Bark (colour + derived normal map) for hero trunks.
// ---------------------------------------------------------------------------
export function makeBark(size = 512) {
  const { c, ctx } = canvas2d(size);
  const R = rng(9271);
  ctx.fillStyle = "#4a3524";
  ctx.fillRect(0, 0, size, size);
  for (let i = 0; i < 90; i++) {
    const x = R() * size;
    ctx.strokeStyle = `rgba(${20 + R() * 30},${14 + R() * 20},${8 + R() * 12},${0.4 + R() * 0.4})`;
    ctx.lineWidth = 1 + R() * 3;
    ctx.beginPath();
    ctx.moveTo(x, 0);
    for (let y = 0; y <= size; y += 24) ctx.lineTo(x + (R() - 0.5) * 10, y);
    ctx.stroke();
  }
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

function normalFromCanvas(src, strength) {
  const w = src.width;
  const h = src.height;
  const sd = src.getContext("2d").getImageData(0, 0, w, h).data;
  const { c, ctx } = canvas2d(w, h);
  const out = ctx.createImageData(w, h);
  const lum = (x, y) => {
    x = (x + w) % w;
    y = (y + h) % h;
    const i = (y * w + x) * 4;
    return (sd[i] * 0.3 + sd[i + 1] * 0.59 + sd[i + 2] * 0.11) / 255;
  };
  for (let y = 0; y < h; y++)
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
  ctx.putImageData(out, 0, 0);
  const t = toTex(c, false);
  t.wrapS = t.wrapT = THREE.RepeatWrapping;
  return t;
}