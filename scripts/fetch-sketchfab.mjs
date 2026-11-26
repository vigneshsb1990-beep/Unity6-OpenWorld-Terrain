// fetch-sketchfab.mjs — Download a Sketchfab model as a self-contained GLB.
// Usage: SKETCHFAB_TOKEN=xxxx node scripts/fetch-sketchfab.mjs <modelUid> [outPath]
// The token is read from the environment and is never written to disk.
import { mkdir, writeFile } from "node:fs/promises";
import { dirname } from "node:path";

const token = process.env.SKETCHFAB_TOKEN;
const uid = process.argv[2];
const out = process.argv[3] || "www/assets/terrain.glb";

if (!token) {
  console.error("Missing SKETCHFAB_TOKEN env var.");
  process.exit(1);
}
if (!uid) {
  console.error("Usage: SKETCHFAB_TOKEN=xxx node scripts/fetch-sketchfab.mjs <modelUid> [outPath]");
  process.exit(1);
}

const headers = { Authorization: `Token ${token}`, Accept: "application/json" };

const metaRes = await fetch(`https://api.sketchfab.com/v3/models/${uid}`, { headers });
if (!metaRes.ok) {
  console.error(`Model metadata failed: ${metaRes.status} ${await metaRes.text()}`);
  process.exit(1);
}
const meta = await metaRes.json();
console.log(`Model: ${meta.name}  (license: ${meta.license?.slug || "unknown"})`);

const dlRes = await fetch(`https://api.sketchfab.com/v3/models/${uid}/download`, { headers });
if (!dlRes.ok) {
  console.error(`Download endpoint failed: ${dlRes.status} ${await dlRes.text()}`);
  console.error("Make sure the token is valid and you have access to this model.");
  process.exit(1);
}
const dl = await dlRes.json();

const url = dl.glb?.url || dl.gltf?.url;
if (!url) {
  console.error("No glb/gltf URL in download response.");
  process.exit(1);
}
if (!dl.glb) {
  console.warn("Only glTF (.gltf + external .bin) is available; saving .gltf may need sidecar files.");
}

const bin = await fetch(url);
if (!bin.ok) {
  console.error(`File download failed: ${bin.status}`);
  process.exit(1);
}
const buf = Buffer.from(await bin.arrayBuffer());
await mkdir(dirname(out), { recursive: true });
await writeFile(out, buf);
console.log(`Saved ${out}  (${(buf.length / 1024 / 1024).toFixed(2)} MB)`);