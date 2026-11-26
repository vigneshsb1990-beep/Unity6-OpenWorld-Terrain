// main.js — Scene assembly, lighting, sky, and lightweight orbit controls
// (mouse + touch) so the game is playable on Android without extra addons.
import * as THREE from "three";
import {
  makeGrassTexture,
  makeDirtTexture,
  makeStoneTexture,
  makeRoofTexture,
  makeWoodTexture,
  makeBarkTexture,
} from "./textures.js";
import { createTerrain, createPath } from "./terrain.js";
import { createForest } from "./forest.js";
import { createPalace } from "./palace.js";

const canvas = document.getElementById("scene");
const loadingEl = document.getElementById("loading");
const statsEl = document.getElementById("stats");

let renderer, scene, camera, clock;
let controls;

init();

function init() {
  // Give the loading UI a frame to paint before the heavy texture generation.
  requestAnimationFrame(() => setTimeout(boot, 60));
}

function boot() {
  renderer = new THREE.WebGLRenderer({
    canvas,
    antialias: true,
    powerPreference: "high-performance",
  });
  renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
  renderer.setSize(window.innerWidth, window.innerHeight);
  renderer.shadowMap.enabled = true;
  renderer.shadowMap.type = THREE.PCFSoftShadowMap;
  renderer.outputColorSpace = THREE.SRGBColorSpace;
  renderer.toneMapping = THREE.ACESFilmicToneMapping;
  renderer.toneMappingExposure = 1.05;

  scene = new THREE.Scene();
  scene.fog = new THREE.Fog(0x9fc4c9, 220, 520);

  camera = new THREE.PerspectiveCamera(
    58,
    window.innerWidth / window.innerHeight,
    0.1,
    2000
  );

  clock = new THREE.Clock();

  buildWorld();
  setupLights();
  setupSky();

  controls = new OrbitControls(camera, canvas);
  controls.target.set(0, 14, 0);
  controls.setView(150, 0.9, 0.6); // radius, phi, theta

  window.addEventListener("resize", onResize);
  document.addEventListener("visibilitychange", () => clock.getDelta());

  // Reveal the scene.
  loadingEl.classList.add("hidden");
  animate();
}

function buildWorld() {
  // ---- materials (2K procedural textures) --------------------------------
  const grass = makeGrassTexture();
  grass.repeat.set(48, 48);
  const dirt = makeDirtTexture();
  dirt.repeat.set(1, 2);
  const stone = makeStoneTexture();
  stone.repeat.set(3, 2);
  const roof = makeRoofTexture();
  roof.repeat.set(3, 3);
  const wood = makeWoodTexture();
  const bark = makeBarkTexture();

  const materials = {
    grass: new THREE.MeshStandardMaterial({ map: grass, roughness: 1, metalness: 0 }),
    dirt: new THREE.MeshStandardMaterial({ map: dirt, roughness: 1 }),
    stone: new THREE.MeshStandardMaterial({ map: stone, roughness: 0.95, metalness: 0 }),
    roof: new THREE.MeshStandardMaterial({ map: roof, roughness: 0.85 }),
    wood: new THREE.MeshStandardMaterial({ map: wood, roughness: 0.8 }),
    bark: new THREE.MeshStandardMaterial({ map: bark, roughness: 1 }),
    leaves: new THREE.MeshStandardMaterial({ color: 0xffffff, roughness: 0.9 }),
    darkStone: new THREE.MeshStandardMaterial({ color: 0x6a6a70, roughness: 1 }),
    window: new THREE.MeshStandardMaterial({
      color: 0x101418,
      emissive: 0x223344,
      emissiveIntensity: 0.6,
      roughness: 0.4,
    }),
  };

  scene.add(createTerrain(materials));
  scene.add(createPath(materials));
  scene.add(createForest(materials));
  scene.add(createPalace(materials));
}

function setupLights() {
  const hemi = new THREE.HemisphereLight(0xbfd8ff, 0x3a5a3a, 0.9);
  scene.add(hemi);

  const sun = new THREE.DirectionalLight(0xfff2d6, 2.2);
  sun.position.set(120, 180, 80);
  sun.castShadow = true;
  sun.shadow.mapSize.set(1024, 1024);
  const s = 180;
  sun.shadow.camera.left = -s;
  sun.shadow.camera.right = s;
  sun.shadow.camera.top = s;
  sun.shadow.camera.bottom = -s;
  sun.shadow.camera.near = 10;
  sun.shadow.camera.far = 500;
  sun.shadow.bias = -0.0004;
  scene.add(sun);
  scene.add(sun.target);

  const amb = new THREE.AmbientLight(0x404a55, 0.4);
  scene.add(amb);
}

function setupSky() {
  const skyGeo = new THREE.SphereGeometry(900, 32, 16);
  const skyMat = new THREE.ShaderMaterial({
    side: THREE.BackSide,
    depthWrite: false,
    uniforms: {
      top: { value: new THREE.Color(0x2a6fb0) },
      bottom: { value: new THREE.Color(0xcfe6e2) },
      offset: { value: 120 },
      exponent: { value: 0.7 },
    },
    vertexShader: `
      varying vec3 vWorld;
      void main() {
        vec4 wp = modelMatrix * vec4(position, 1.0);
        vWorld = wp.xyz;
        gl_Position = projectionMatrix * viewMatrix * wp;
      }`,
    fragmentShader: `
      uniform vec3 top; uniform vec3 bottom;
      uniform float offset; uniform float exponent;
      varying vec3 vWorld;
      void main() {
        float h = normalize(vWorld + vec3(0.0, offset, 0.0)).y;
        float t = pow(max(h, 0.0), exponent);
        gl_FragColor = vec4(mix(bottom, top, t), 1.0);
      }`,
  });
  scene.add(new THREE.Mesh(skyGeo, skyMat));
}

let frames = 0;
let fpsTime = 0;
let fps = 0;

function animate() {
  requestAnimationFrame(animate);
  const dt = clock.getDelta();
  controls.update(dt);
  renderer.render(scene, camera);

  // lightweight stats readout
  frames++;
  fpsTime += dt;
  if (fpsTime >= 0.5) {
    fps = Math.round(frames / fpsTime);
    frames = 0;
    fpsTime = 0;
    const tris = renderer.info.render.triangles;
    statsEl.textContent = `${fps} fps · ${(tris / 1000).toFixed(0)}k tris`;
  }
}

function onResize() {
  camera.aspect = window.innerWidth / window.innerHeight;
  camera.updateProjectionMatrix();
  renderer.setSize(window.innerWidth, window.innerHeight);
}

// ---------------------------------------------------------------------------
// Minimal orbit controls (mouse + touch). No external addons required.
// ---------------------------------------------------------------------------
class OrbitControls {
  constructor(cam, dom) {
    this.cam = cam;
    this.dom = dom;
    this.target = new THREE.Vector3();
    this.radius = 160;
    this.theta = 0.6; // azimuth
    this.phi = 1.0; // polar (from +Y)
    this.minPhi = 0.15;
    this.maxPhi = Math.PI / 2 - 0.05;
    this.minR = 40;
    this.maxR = 420;
    this.autoRotate = true;
    this.autoSpeed = 0.06;

    this._pointers = new Map();
    this._lastPinch = 0;

    dom.addEventListener("pointerdown", (e) => this._down(e));
    dom.addEventListener("pointermove", (e) => this._move(e));
    dom.addEventListener("pointerup", (e) => this._up(e));
    dom.addEventListener("pointercancel", (e) => this._up(e));
    dom.addEventListener("wheel", (e) => this._wheel(e), { passive: false });
  }

  setView(radius, phi, theta) {
    this.radius = radius;
    this.phi = phi;
    this.theta = theta;
    this.update(0);
  }

  _down(e) {
    this.dom.setPointerCapture(e.pointerId);
    this._pointers.set(e.pointerId, { x: e.clientX, y: e.clientY });
    this.autoRotate = false;
    if (this._pointers.size === 2) this._lastPinch = this._pinchDist();
  }

  _move(e) {
    const p = this._pointers.get(e.pointerId);
    if (!p) return;
    const dx = e.clientX - p.x;
    const dy = e.clientY - p.y;
    p.x = e.clientX;
    p.y = e.clientY;

    if (this._pointers.size === 1) {
      this.theta -= dx * 0.005;
      this.phi -= dy * 0.005;
      this.phi = Math.max(this.minPhi, Math.min(this.maxPhi, this.phi));
    } else if (this._pointers.size === 2) {
      const d = this._pinchDist();
      if (this._lastPinch > 0) {
        this.radius *= this._lastPinch / d;
        this.radius = Math.max(this.minR, Math.min(this.maxR, this.radius));
      }
      this._lastPinch = d;
    }
  }

  _up(e) {
    this._pointers.delete(e.pointerId);
    if (this._pointers.size < 2) this._lastPinch = 0;
  }

  _wheel(e) {
    e.preventDefault();
    this.autoRotate = false;
    this.radius *= 1 + Math.sign(e.deltaY) * 0.08;
    this.radius = Math.max(this.minR, Math.min(this.maxR, this.radius));
  }

  _pinchDist() {
    const pts = [...this._pointers.values()];
    return Math.hypot(pts[0].x - pts[1].x, pts[0].y - pts[1].y);
  }

  update(dt) {
    if (this.autoRotate) this.theta += this.autoSpeed * dt;
    const sinPhi = Math.sin(this.phi);
    this.cam.position.set(
      this.target.x + this.radius * sinPhi * Math.sin(this.theta),
      this.target.y + this.radius * Math.cos(this.phi),
      this.target.z + this.radius * sinPhi * Math.cos(this.theta)
    );
    this.cam.lookAt(this.target);
  }
}