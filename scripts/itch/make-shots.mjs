// Screenshots für die itch.io-Seite (itch/shot-*.png, 1280×800, englisch) aus dem fertigen Build (dist/).
// Vorher: npm run build.  Aufruf: node scripts/itch/make-shots.mjs   (FONT_DIR wie bei make-og.mjs, falls offline)
import { createServer } from 'node:http';
import { createReadStream, existsSync, readFileSync, mkdirSync, statSync } from 'node:fs';
import { createRequire } from 'node:module';
import { join, extname } from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = fileURLToPath(new URL('../..', import.meta.url)), DIST = join(ROOT, 'dist'), OUT = join(ROOT, 'itch');
const { chromium } = createRequire(import.meta.url)('playwright');
const TYPES = { '.html': 'text/html', '.js': 'text/javascript', '.css': 'text/css', '.json': 'application/json', '.mp3': 'audio/mpeg', '.woff2': 'font/woff2', '.png': 'image/png', '.svg': 'image/svg+xml' };
const server = createServer((req, res) => {
  const u = decodeURIComponent(req.url.split('?')[0]);
  if (u.startsWith('/api/')) { res.writeHead(200, { 'content-type': 'application/json' }); res.end('{"scores":[]}'); return; }
  let f = join(DIST, u); if (existsSync(f) && statSync(f).isDirectory()) f = join(f, 'index.html');
  if (!f.startsWith(DIST) || !existsSync(f)) { res.writeHead(404); res.end(); return; }
  res.writeHead(200, { 'content-type': TYPES[extname(f)] || 'application/octet-stream' }); createReadStream(f).pipe(res);
});
await new Promise(r => server.listen(0, '127.0.0.1', r));
const url = `http://127.0.0.1:${server.address().port}/?lang=en`;
mkdirSync(OUT, { recursive: true });
const browser = await chromium.launch();
const page = await browser.newPage({ viewport: { width: 1280, height: 800 } });
if (process.env.FONT_DIR) {
  const dir = process.env.FONT_DIR, ff = n => `url(data:font/woff2;base64,${readFileSync(join(dir, n)).toString('base64')})`;
  await page.route('https://fonts.googleapis.com/**', r => r.fulfill({ contentType: 'text/css', body:
    `@font-face{font-family:Silkscreen;font-weight:700;src:${ff('silkscreen-700.woff2')}}@font-face{font-family:Silkscreen;font-weight:400;src:${ff('silkscreen-400.woff2')}}@font-face{font-family:'IBM Plex Mono';font-weight:400 600;src:${ff('plex-500.woff2')}}` }));
}
const wait = ms => new Promise(r => setTimeout(r, ms));
// Titel
await page.goto(url); await page.evaluate(() => document.fonts.ready); await wait(900);
await page.screenshot({ path: join(OUT, 'shot-1-title.png') });
// Räume: Seed, Raum, Zug bis Gegner sichtbar sind
async function room(seed, cls, idx, file, moves = 0) {
  await page.goto(url); await wait(500);
  await page.evaluate(([s, c, i]) => { const a = __wrack.actions; a.startRun(s, c); if (i > 1) { __wrack.S.G.log.length = 0; a.enterRoom(i, 'L'); } }, [seed, cls, idx]);
  for (let k = 0; k < moves; k++) { await page.evaluate(() => { const S = __wrack.S, G = S.G, a = __wrack.actions; if (S.busy || G.phase !== 'player') return; if (G.p.mp > 0) a.stepPlayer(1, 0); else a.endTurn(); }); await wait(900); }
  await wait(900); await page.evaluate(() => window.scrollTo(0, 0));
  await page.screenshot({ path: join(OUT, file) });
}
await room('NEBULA', 'marine', 1, 'shot-2-cargo.png', 3);
await room('KEPLER', 'scout', 5, 'shot-3-habitat.png', 2);
await room('REAKTOR', 'tech', 7, 'shot-4-reactor.png', 2);
await room('BROOD', 'marine', 9, 'shot-5-brood.png', 1);
await browser.close(); server.close();
console.log('itch/shot-*.png geschrieben');
