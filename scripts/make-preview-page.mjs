// make-preview-page.mjs — Build a self-contained preview.html (images embedded).
import { readFile, writeFile } from "node:fs/promises";

const shots = [
  { file: "preview-1-hero.png", title: "Hero", caption: "The palace and fort rising above the forest" },
  { file: "preview-2-aerial.png", title: "Aerial", caption: "Bird's-eye view of the whole valley" },
  { file: "preview-3-low.png", title: "Forest floor", caption: "Low angle through trees and undergrowth" },
  { file: "preview-4-gate.png", title: "Gatehouse", caption: "Twin towers and the main gate" },
];

const cards = [];
for (const s of shots) {
  const buf = await readFile(`/artifacts/${s.file}`);
  const b64 = buf.toString("base64");
  cards.push(`<figure class="card">
  <img loading="lazy" src="data:image/png;base64,${b64}" alt="${s.title}">
  <figcaption><h2>${s.title}</h2><p>${s.caption}</p></figcaption>
</figure>`);
}

const html = `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width, initial-scale=1.0">
<title>Forest Palace Fort — Preview</title>
<style>
  :root{--bg:#0b1410;--fg:#e9f3ec;--accent:#7bd88f;--card:#12211a;}
  *{box-sizing:border-box;margin:0;padding:0;}
  body{background:radial-gradient(circle at 50% 0%,#14251b,#0b1410 60%);color:var(--fg);
    font-family:-apple-system,BlinkMacSystemFont,"Segoe UI",Roboto,sans-serif;min-height:100vh;padding:32px 16px 64px;}
  header{text-align:center;margin-bottom:28px;}
  header h1{font-size:clamp(24px,5vw,40px);letter-spacing:.5px;}
  header p{opacity:.7;margin-top:8px;font-size:15px;}
  .badge{display:inline-block;margin-top:14px;padding:6px 12px;border-radius:999px;
    background:rgba(123,216,143,.12);color:var(--accent);font-size:12px;font-weight:600;letter-spacing:.4px;}
  .grid{max-width:1100px;margin:0 auto;display:grid;gap:20px;
    grid-template-columns:repeat(auto-fit,minmax(320px,1fr));}
  .card{background:var(--card);border-radius:16px;overflow:hidden;
    box-shadow:0 10px 30px rgba(0,0,0,.45);border:1px solid rgba(255,255,255,.05);}
  .card img{display:block;width:100%;height:auto;}
  .card figcaption{padding:14px 16px 18px;}
  .card h2{font-size:17px;margin-bottom:4px;}
  .card p{font-size:13px;opacity:.65;line-height:1.4;}
  footer{max-width:1100px;margin:32px auto 0;text-align:center;opacity:.5;font-size:12px;line-height:1.6;}
  a{color:var(--accent);}
</style>
</head>
<body>
  <header>
    <h1>Forest Palace Fort</h1>
    <p>Android 3D game · forest terrain · giant palace &amp; fort · 2K procedural textures</p>
    <span class="badge">4 in-engine renders · 1600×900</span>
  </header>
  <main class="grid">${cards.join("\n")}
  </main>
  <footer>
    Renders captured from the running WebGL build (Three.js). The Android APK and
    full source are in the project. Open <code>index.html</code> via a local
    server to play.
  </footer>
</body>
</html>`;

await writeFile("/artifacts/preview.html", html);
console.log(`Wrote /artifacts/preview.html (${(html.length / 1024 / 1024).toFixed(2)} MB)`);