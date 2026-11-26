// heightfield.js — Single source of truth for ground height.
// Defaults to the procedural terrain; main.js can swap in a sampler built from
// a loaded Sketchfab terrain mesh so trees/plants/palace sit on the real ground.

// Smooth rolling hills (deterministic, tileable-ish via summed sines).
export function terrainHeight(x, z) {
  let h = 0;
  h += Math.sin(x * 0.045) * Math.cos(z * 0.05) * 6.0;
  h += Math.sin(x * 0.11 + 1.7) * Math.cos(z * 0.09 + 0.4) * 2.5;
  h += Math.sin(x * 0.21 + 4.0) * Math.cos(z * 0.19 + 2.0) * 1.0;

  // Flatten a plateau in the middle so the palace sits level.
  const d = Math.sqrt(x * x + z * z);
  const plateau = 1.0 - smoothstep(70, 130, d);
  h = h * (1 - plateau) + 0.0 * plateau;

  // Gentle rise far away to hide the horizon edge.
  h += smoothstep(190, 320, d) * 22.0;
  return h;
}

function smoothstep(a, b, x) {
  const t = Math.min(1, Math.max(0, (x - a) / (b - a)));
  return t * t * (3 - 2 * t);
}

let heightFn = terrainHeight;

export function setHeightFn(fn) {
  heightFn = fn;
}
export function resetHeightFn() {
  heightFn = terrainHeight;
}
export function heightAt(x, z) {
  return heightFn(x, z);
}

// Build a bilinear height sampler by raycasting a loaded terrain mesh.
// Returns a function (x,z)->y in world space.
export function buildMeshSampler(mesh, extent = 640, N = 128) {
  mesh.updateWorldMatrix(true, true);
  const ray = new THREE.Raycaster();
  const down = new THREE.Vector3(0, -1, 0);
  const origin = new THREE.Vector3();
  const grid = new Float32Array((N + 1) * (N + 1));
  const half = extent / 2;
  const step = extent / N;

  for (let j = 0; j <= N; j++) {
    const z = -half + j * step;
    for (let i = 0; i <= N; i++) {
      const x = -half + i * step;
      origin.set(x, 4000, z);
      ray.set(origin, down);
      const hits = ray.intersectObject(mesh, true);
      grid[j * (N + 1) + i] = hits.length ? hits[0].point.y : 0;
    }
  }

  return (x, z) => {
    const fx = (x + half) / step;
    const fz = (z + half) / step;
    const i = Math.max(0, Math.min(N - 1, Math.floor(fx)));
    const j = Math.max(0, Math.min(N - 1, Math.floor(fz)));
    const tx = Math.max(0, Math.min(1, fx - i));
    const tz = Math.max(0, Math.min(1, fz - j));
    const h00 = grid[j * (N + 1) + i];
    const h10 = grid[j * (N + 1) + i + 1];
    const h01 = grid[(j + 1) * (N + 1) + i];
    const h11 = grid[(j + 1) * (N + 1) + i + 1];
    return (
      h00 * (1 - tx) * (1 - tz) +
      h10 * tx * (1 - tz) +
      h01 * (1 - tx) * tz +
      h11 * tx * tz
    );
  };
}