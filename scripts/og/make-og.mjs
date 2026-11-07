// Vorschaubild für geteilte Links (public/og.png, 1200×630) aus der Titelszene.
// Braucht Playwright mit Chromium:  npm i -D playwright && npx playwright install chromium
// Aufruf im Projektordner:          node scripts/og/make-og.mjs
// Ohne Internet: FONT_DIR auf einen Ordner mit silkscreen-700.woff2, silkscreen-400.woff2 und plex-500.woff2 setzen.
import { createServer } from 'node:http';
import { createReadStream, existsSync, readFileSync } from 'node:fs';
import { createRequire } from 'node:module';
import { join, extname } from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = fileURLToPath(new URL('../..', import.meta.url));
const { chromium } = createRequire(import.meta.url)('playwright');

const PAGE = `<!doctype html><html><head><meta charset="utf-8">
<link rel="stylesheet" href="https://fonts.googleapis.com/css2?family=Silkscreen:wght@400;700&family=IBM+Plex+Mono:wght@500&display=block">
<style>
@font-face{font-family:'Big Shoulders Stencil';font-weight:800;src:url('/public/fonts/big-shoulders-stencil-800.woff2') format('woff2')}
html,body{margin:0;width:1200px;height:630px;background:#05070b;overflow:hidden}
canvas{position:absolute;inset:0;width:1200px;height:630px;image-rendering:pixelated}
.t{position:absolute;left:64px;bottom:56px;display:grid;gap:14px}
.e{font:500 18px 'IBM Plex Mono',monospace;letter-spacing:.14em;text-transform:uppercase;color:#5fd3e6;text-shadow:0 2px 0 #05070b}
h1{margin:0;font:800 150px/.84 'Big Shoulders Stencil','Arial Narrow',sans-serif;letter-spacing:.035em;color:#ffb000;text-transform:uppercase;text-shadow:0 4px 0 #05070b,0 0 40px rgba(5,7,11,.95)}
.s{height:12px;width:440px;background:repeating-linear-gradient(-45deg,#ffb000 0 12px,transparent 12px 24px)}
.u{font:500 22px 'IBM Plex Mono',monospace;color:#d3dbe3;text-shadow:0 2px 0 #05070b}
</style></head><body>
<canvas id="c" width="400" height="210"></canvas>
<div class="t"><div class="e">Notruf IKARUS-7 · Orbit Kepler-442b</div><h1>Wrack<br>Ikarus</h1><div class="s"></div>
<div class="u">Sci-Fi-Roguelike im Browser</div></div>
<script type="module">
import {createTitleScene} from '/src/render/titleScene.js';
const s=createTitleScene(400,210);s.draw(document.getElementById('c').getContext('2d'),0.3);
await document.fonts.ready;window.__ok=true;
</script></body></html>`;

const server = createServer((req, res) => {
  const u = decodeURIComponent(req.url.split('?')[0]);
  if (u === '/__og.html') { res.writeHead(200, { 'content-type': 'text/html' }); res.end(PAGE); return; }
  const f = join(ROOT, u);
  if (!f.startsWith(ROOT) || !existsSync(f)) { res.writeHead(404); res.end(); return; }
  res.writeHead(200, { 'content-type': extname(f) === '.js' ? 'text/javascript' : extname(f) === '.woff2' ? 'font/woff2' : 'application/octet-stream' });
  createReadStream(f).pipe(res);
});
await new Promise(r => server.listen(0, '127.0.0.1', r));

const browser = await chromium.launch();
const page = await browser.newPage({ viewport: { width: 1200, height: 630 } });
if (process.env.FONT_DIR) {
  const dir = process.env.FONT_DIR, ff = n => `url(data:font/woff2;base64,${readFileSync(join(dir, n)).toString('base64')})`;
  await page.route('https://fonts.googleapis.com/**', r => r.fulfill({ contentType: 'text/css', body:
    `@font-face{font-family:Silkscreen;font-weight:700;src:${ff('silkscreen-700.woff2')}}@font-face{font-family:Silkscreen;font-weight:400;src:${ff('silkscreen-400.woff2')}}@font-face{font-family:'IBM Plex Mono';font-weight:500;src:${ff('plex-500.woff2')}}` }));
}
await page.goto(`http://127.0.0.1:${server.address().port}/__og.html`);
await page.waitForFunction(() => window.__ok, null, { timeout: 20000 });
await page.screenshot({ path: join(ROOT, 'public', 'og.png') });
await browser.close(); server.close();
console.log('public/og.png geschrieben');
