// forest.js — Full realistic forest: many tree species + understory plants,
// grass and flowers. Alpha-cutout billboards, 3D hero trunks, wind sway.
import * as THREE from "three";
import { heightAt } from "./heightfield.js";
import {
  makeTreeTexture,
  makePoplarTexture,
  makeConiferTexture,
  makeWillowTexture,
  makeDeadTreeTexture,
  makePalmTexture,
  makeBushTexture,
  makeFlowerTexture,
  makeTallGrassTexture,
  makeGrassTuft,
  makeBark,
} from "./treetextures.js";

export const windTime = { value: 0 };
export function updateWind(t) {
  windTime.value = t;
}

function rng(seed) {
  let s = seed >>> 0 || 1;
  return () => {
    s ^= s << 13;
    s ^= s >>> 17;
    s ^= s << 5;
    return ((s >>> 0) % 1000000) / 1000000;
  };
}

function crossedPlanes(n, w, h) {
  const positions = [];
  const normals = [];
  const uvs = [];
  const indices = [];
  for (let p = 0; p < n; p++) {
    const g = new THREE.PlaneGeometry(w, h);
    g.translate(0, h / 2, 0);
    g.rotateY((p / n) * Math.PI);
    const pos = g.attributes.position;
    const nor = g.attributes.normal;
    const uv = g.attributes.uv;
    const base = positions.length / 3;
    for (let i = 0; i < pos.count; i++) {
      positions.push(pos.getX(i), pos.getY(i), pos.getZ(i));
      normals.push(nor.getX(i), nor.getY(i), nor.getZ(i));
      uvs.push(uv.getX(i), uv.getY(i));
    }
    const idx = g.index.array;
    for (let i = 0; i < idx.length; i++) indices.push(base + idx[i]);
    g.dispose();
  }
  const geo = new THREE.BufferGeometry();
  geo.setAttribute("position", new THREE.Float32BufferAttribute(positions, 3));
  geo.setAttribute("normal", new THREE.Float32BufferAttribute(normals, 3));
  geo.setAttribute("uv", new THREE.Float32BufferAttribute(uvs, 2));
  geo.setIndex(indices);
  return geo;
}

function addWind(mat) {
  mat.onBeforeCompile = (shader) => {
    shader.uniforms.uTime = windTime;
    shader.vertexShader = "uniform float uTime;\n" + shader.vertexShader;
    shader.vertexShader = shader.vertexShader.replace(
      "#include <begin_vertex>",
      `#include <begin_vertex>
       #ifdef USE_INSTANCING
         float ph = instanceMatrix[3].x * 0.35 + instanceMatrix[3].z * 0.35;
       #else
         float ph = 0.0;
       #endif
       float sway = sin(uTime * 1.2 + ph) * 0.05 + sin(uTime * 2.3 + ph * 1.7) * 0.02;
       float bend = pow(uv.y, 2.0);
       transformed.x += sway * bend;
       transformed.z += sway * 0.6 * bend;`
    );
  };
  mat.customProgramCacheKey = () => "wind";
}

// Weighted pick.
function pick(list, r) {
  for (const it of list) {
    if (r < it.weight) return it;
    r -= it.weight;
  }
  return list[list.length - 1];
}

export function createForest(count = 540) {
  const group = new THREE.Group();
  group.name = "forest";
  const R = rng(20241126);

  // ---- TREE species -------------------------------------------------------
  const trees = [
    { name: "oak", tex: makeTreeTexture({ seed: 11, hue: 110, sat: 45, light: 30, spread: 0.6 }), weight: 0.22, h: [16, 30], wf: [0.9, 1.15] },
    { name: "maple", tex: makeTreeTexture({ seed: 23, hue: 28, sat: 55, light: 34, spread: 0.62, density: 1.1 }), weight: 0.12, h: [14, 24], wf: [0.9, 1.1] },
    { name: "birch", tex: makeTreeTexture({ seed: 37, hue: 95, sat: 40, light: 34, spread: 0.5, leafScale: 0.8, bark: "white" }), weight: 0.14, h: [16, 28], wf: [0.55, 0.75] },
    { name: "poplar", tex: makePoplarTexture({ seed: 71 }), weight: 0.1, h: [20, 34], wf: [0.4, 0.55] },
    { name: "pine", tex: makeConiferTexture({ seed: 3, hue: 135, sat: 40, light: 22 }), weight: 0.2, h: [18, 34], wf: [0.7, 0.95] },
    { name: "willow", tex: makeWillowTexture({ seed: 55 }), weight: 0.08, h: [14, 22], wf: [1.0, 1.3] },
    { name: "dead", tex: makeDeadTreeTexture({ seed: 88 }), weight: 0.06, h: [12, 22], wf: [0.8, 1.0] },
    { name: "palm", tex: makePalmTexture({ seed: 123 }), weight: 0.08, h: [12, 20], wf: [0.9, 1.1] },
  ];

  const treeGeo = crossedPlanes(3, 1, 1);
  const treeMeshes = trees.map((t) => {
    const mat = new THREE.MeshStandardMaterial({
      map: t.tex,
      alphaTest: 0.35,
      side: THREE.DoubleSide,
      roughness: 0.9,
    });
    addWind(mat);
    const m = new THREE.InstancedMesh(treeGeo, mat, count);
    m.castShadow = true;
    m.receiveShadow = true;
    m.customDepthMaterial = new THREE.MeshDepthMaterial({
      depthPacking: THREE.RGBADepthPacking,
      map: t.tex,
      alphaTest: 0.35,
    });
    m.count = 0;
    group.add(m);
    return m;
  });
  const treeCount = trees.map(() => 0);

  const m4 = new THREE.Matrix4();
  const q = new THREE.Quaternion();
  const pos = new THREE.Vector3();
  const scl = new THREE.Vector3();
  const up = new THREE.Vector3(0, 1, 0);
  const col = new THREE.Color();

  let placed = 0;
  let guard = 0;
  while (placed < count && guard < count * 60) {
    guard++;
    const x = (R() - 0.5) * 600;
    const z = (R() - 0.5) * 600;
    const d = Math.hypot(x, z);
    if (d < 100) continue;
    if (Math.abs(x - Math.sin((z / 300) * Math.PI * 2) * 10) < 13 && z > 78) continue;
    const t = pick(trees, R());
    const y = heightAt(x, z);
    const h = t.h[0] + R() * (t.h[1] - t.h[0]);
    const wf = t.wf[0] + R() * (t.wf[1] - t.wf[0]);
    pos.set(x, y - 0.3, z);
    q.setFromAxisAngle(up, R() * Math.PI * 2);
    scl.set(h * wf, h, h * wf);
    m4.compose(pos, q, scl);
    const idx = trees.indexOf(t);
    treeMeshes[idx].setMatrixAt(treeCount[idx], m4);
    const tint = 0.8 + R() * 0.4;
    col.setRGB(tint, tint * (0.95 + R() * 0.1), tint * 0.95);
    treeMeshes[idx].setColorAt(treeCount[idx], col);
    treeCount[idx]++;
    placed++;
  }
  treeMeshes.forEach((m, i) => {
    m.count = treeCount[i];
    m.instanceMatrix.needsUpdate = true;
    if (m.instanceColor) m.instanceColor.needsUpdate = true;
  });

  // ---- UNDERSTORY plants, grass, flowers ---------------------------------
  const plants = [
    { name: "bush", tex: makeBushTexture({ seed: 202 }), weight: 0.22, s: [0.8, 2.0] },
    { name: "fern", tex: makeGrassTuft(256, 8, true), weight: 0.2, s: [0.7, 1.6] },
    { name: "tallgrass", tex: makeTallGrassTexture({ seed: 404 }), weight: 0.22, s: [0.8, 1.8] },
    { name: "flowers", tex: makeFlowerTexture({ seed: 303 }), weight: 0.16, s: [0.6, 1.3] },
    { name: "grass", tex: makeGrassTuft(256, 5, false), weight: 0.2, s: [0.6, 1.4] },
  ];
  const plantGeo = crossedPlanes(2, 1, 1);
  const plantMeshes = plants.map((p) => {
    const mat = new THREE.MeshStandardMaterial({
      map: p.tex,
      alphaTest: 0.4,
      side: THREE.DoubleSide,
      roughness: 1,
    });
    addWind(mat);
    const m = new THREE.InstancedMesh(plantGeo, mat, count * 4);
    m.receiveShadow = true;
    m.count = 0;
    group.add(m);
    return m;
  });
  const plantCount = plants.map(() => 0);

  const plantTarget = count * 4;
  let pPlaced = 0;
  guard = 0;
  while (pPlaced < plantTarget && guard < plantTarget * 30) {
    guard++;
    const x = (R() - 0.5) * 560;
    const z = (R() - 0.5) * 560;
    const d = Math.hypot(x, z);
    if (d < 74) continue;
    const p = pick(plants, R());
    const y = heightAt(x, z);
    const s = p.s[0] + R() * (p.s[1] - p.s[0]);
    pos.set(x, y - 0.1, z);
    q.setFromAxisAngle(up, R() * Math.PI * 2);
    scl.set(s, s * (0.8 + R() * 0.5), s);
    m4.compose(pos, q, scl);
    const idx = plants.indexOf(p);
    plantMeshes[idx].setMatrixAt(plantCount[idx], m4);
    plantCount[idx]++;
    pPlaced++;
  }
  plantMeshes.forEach((m, i) => {
    m.count = plantCount[i];
    m.instanceMatrix.needsUpdate = true;
  });

  group.add(createHeroTrees(R));
  return group;
}

function createHeroTrees(R) {
  const g = new THREE.Group();
  const bark = makeBark(512);
  bark.map.repeat.set(1, 3);
  bark.normal.repeat.set(1, 3);
  const barkMat = new THREE.MeshStandardMaterial({
    map: bark.map,
    normalMap: bark.normal,
    normalScale: new THREE.Vector2(1.2, 1.2),
    roughness: 1,
  });
  const canopyTex = makeTreeTexture({ seed: 99, hue: 105, sat: 48, light: 31, spread: 0.65 });
  const canopyMat = new THREE.MeshStandardMaterial({
    map: canopyTex,
    alphaTest: 0.35,
    side: THREE.DoubleSide,
    roughness: 0.9,
  });
  addWind(canopyMat);
  const canopyGeo = crossedPlanes(3, 1, 1);

  const spots = [
    [70, 120],
    [-64, 150],
    [40, 210],
    [-80, 250],
    [95, 300],
    [-40, 330],
  ];
  for (const [x, z] of spots) {
    const y = heightAt(x, z);
    const trunkH = 7 + R() * 3;
    const trunk = new THREE.Mesh(new THREE.CylinderGeometry(0.35, 0.6, trunkH, 8), barkMat);
    trunk.position.set(x, y + trunkH / 2, z);
    trunk.castShadow = trunk.receiveShadow = true;
    g.add(trunk);
    const ch = 16 + R() * 6;
    const canopy = new THREE.Mesh(canopyGeo, canopyMat);
    canopy.position.set(x, y + trunkH - 2, z);
    canopy.scale.set(ch * 0.9, ch, ch * 0.9);
    canopy.castShadow = true;
    g.add(canopy);
  }
  return g;
}