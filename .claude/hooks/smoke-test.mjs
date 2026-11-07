// Stop-Hook: baut das Spiel (vite build), liefert dist/ über einen kleinen lokalen Server aus,
// lädt es in Headless-Chrome, startet einen Run, drückt ein paar Tasten und meldet
// Build- und Laufzeitfehler (Exceptions, console.error) an Claude zurück (Exit 2).
// Läuft nur, wenn sich index.html, src/ oder public/ seit dem letzten erfolgreichen Durchlauf geändert haben.
// Manuell: node .claude/hooks/smoke-test.mjs --force
import { spawn, spawnSync } from 'node:child_process';
import { createReadStream, existsSync, mkdtempSync, readdirSync, readFileSync, rmSync, statSync, writeFileSync } from 'node:fs';
import { createServer } from 'node:http';
import { tmpdir } from 'node:os';
import { extname, join, normalize } from 'node:path';

const CHROME = process.env.CHROME_PATH || '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome';
const dir = process.env.CLAUDE_PROJECT_DIR || process.cwd();
const page = join(dir, 'index.html');
const dist = join(dir, 'dist');
const marker = join(dir, '.claude', '.smoke-ok');

// Jüngste Änderung an den Quellen des Spiels
function newest(p) {
  if (!existsSync(p)) return 0;
  const st = statSync(p);
  if (!st.isDirectory()) return st.mtimeMs;
  return Math.max(st.mtimeMs, ...readdirSync(p).map(n => newest(join(p, n))));
}
const sourcesChanged = () => Math.max(newest(page), newest(join(dir, 'src')), newest(join(dir, 'public')), newest(join(dir, 'vite.config.mjs')));
const force = process.argv.includes('--force');

let input = '';
if (!process.stdin.isTTY) for await (const chunk of process.stdin) input += chunk;
const hook = JSON.parse(input || '{}');

// Nicht endlos blockieren: nach einem gemeldeten Fehler darf Claude beim zweiten Stop beenden
if (hook.stop_hook_active && !force) process.exit(0);
if (!existsSync(page) || !existsSync(CHROME)) process.exit(0);
if (!force && existsSync(marker) && statSync(marker).mtimeMs >= sourcesChanged()) process.exit(0);

if (!existsSync(join(dir, 'node_modules', 'vite'))) {
  console.error('Smoke-Test: Abhängigkeiten fehlen. Bitte zuerst `npm install` im Projektordner ausführen.');
  process.exit(2);
}
const build = spawnSync(process.platform === 'win32' ? 'npm.cmd' : 'npm', ['run', 'build', '--silent'], { cwd: dir, encoding: 'utf8' });
if (build.status !== 0) {
  console.error(`Smoke-Test: \`npm run build\` ist fehlgeschlagen:\n\n${(build.stderr || build.stdout || '').trim().slice(-3000)}`);
  process.exit(2);
}

// Kleiner Server für dist/. /api/scores und die Vercel-Analytics gibt es lokal nicht, sie werden ersetzt.
const TYPES = { '.html': 'text/html', '.js': 'text/javascript', '.css': 'text/css', '.png': 'image/png', '.mp3': 'audio/mpeg', '.ogg': 'audio/ogg', '.json': 'application/json', '.svg': 'image/svg+xml' };
const server = createServer((req, res) => {
  const url = decodeURIComponent(req.url.split('?')[0]);
  if (url.startsWith('/api/scores')) { res.writeHead(200, { 'content-type': 'application/json' }); res.end('{"scores":[]}'); return; }
  if (url.startsWith('/_vercel/')) { res.writeHead(200, { 'content-type': 'text/javascript' }); res.end(''); return; }
  let f = normalize(join(dist, url));
  if (!f.startsWith(dist)) { res.writeHead(403); res.end(); return; }
  if (existsSync(f) && statSync(f).isDirectory()) f = join(f, 'index.html');
  if (!existsSync(f)) { res.writeHead(404); res.end(); return; }
  res.writeHead(200, { 'content-type': TYPES[extname(f)] || 'application/octet-stream' });
  createReadStream(f).pipe(res);
});
await new Promise(r => server.listen(0, '127.0.0.1', r));
const base = `http://127.0.0.1:${server.address().port}/`;

const profile = mkdtempSync(join(tmpdir(), 'wrack-smoke-'));
const chrome = spawn(CHROME, [
  '--headless=new', '--remote-debugging-port=0', `--user-data-dir=${profile}`,
  '--no-first-run', '--no-default-browser-check', '--mute-audio',
  ...(process.getuid?.() === 0 ? ['--no-sandbox'] : []), // als root (z. B. in Containern) startet Chrome sonst nicht
  'about:blank',
], { stdio: 'ignore' });

const errors = [];
const sleep = ms => new Promise(r => setTimeout(r, ms));

try {
  // Chrome schreibt den gewählten Port in DevToolsActivePort
  let port;
  for (let i = 0; i < 150 && !port; i++) {
    await sleep(100);
    try { port = readFileSync(join(profile, 'DevToolsActivePort'), 'utf8').split('\n')[0]; } catch {}
  }
  if (!port) throw new Error('Chrome hat keinen DevTools-Port geöffnet');

  const targets = await (await fetch(`http://127.0.0.1:${port}/json/list`)).json();
  const ws = new WebSocket(targets.find(t => t.type === 'page').webSocketDebuggerUrl);
  await new Promise((res, rej) => { ws.onopen = res; ws.onerror = rej; });

  let id = 0;
  const pending = new Map();
  const send = (method, params = {}) => new Promise((res, rej) => {
    const n = ++id;
    const timer = setTimeout(() => { pending.delete(n); rej(new Error(`${method} hat nicht geantwortet`)); }, 5000);
    pending.set(n, r => { clearTimeout(timer); res(r); });
    ws.send(JSON.stringify({ id: n, method, params }));
  });
  ws.onmessage = ({ data }) => {
    const msg = JSON.parse(data);
    if (msg.id && pending.has(msg.id)) { pending.get(msg.id)(msg.result); pending.delete(msg.id); }
    if (msg.method === 'Runtime.exceptionThrown') {
      const d = msg.params.exceptionDetails;
      errors.push(`Exception (Zeile ${d.lineNumber + 1}): ${d.exception?.description ?? d.text}`);
    }
    if (msg.method === 'Runtime.consoleAPICalled' && msg.params.type === 'error') {
      errors.push(`console.error: ${msg.params.args.map(a => a.value ?? a.description).join(' ')}`);
    }
  };

  await send('Runtime.enable');
  await send('Page.enable');
  await send('Page.navigate', { url: base });
  await sleep(1500);

  const key = async code => {
    const k = { code, key: code.replace(/^Key|^Arrow/, ''), windowsVirtualKeyCode: code === 'Enter' ? 13 : 0 };
    await send('Input.dispatchKeyEvent', { type: 'keyDown', ...k });
    await send('Input.dispatchKeyEvent', { type: 'keyUp', ...k });
    await sleep(150);
  };
  // Run starten, bewegen, schießen, Fähigkeit, Zug beenden
  await send('Runtime.evaluate', { expression: "document.getElementById('startBtn').click()" });
  await sleep(500);
  for (const c of ['KeyD', 'KeyS', 'KeyA', 'KeyW', 'KeyF', 'Escape', 'KeyR', 'Escape', 'Space', 'Space']) await key(c);
  await sleep(1000);

  ws.close();
} catch (e) {
  errors.push(`Smoke-Test konnte nicht laufen: ${e.message}`);
} finally {
  chrome.kill();
  server.close();
  await sleep(200);
  rmSync(profile, { recursive: true, force: true });
}

if (errors.length) {
  console.error(`Smoke-Test des Spiels fehlgeschlagen:\n\n${[...new Set(errors)].join('\n')}`);
  process.exit(2);
}
writeFileSync(marker, new Date().toISOString());
if (force) console.log('Smoke-Test bestanden.');
