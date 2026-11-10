// Spielt mehrere Runs mit dem Test-Bot direkt gegen die Spiellogik (ohne Browser)
// und meldet Abstürze oder hängende Runs. Jeder Run läuft in einem eigenen Prozess,
// damit keine Lernpunkte (LP) von einem Run in den nächsten rutschen.
// Aufruf: npm run check            (9 Runs)
//         node scripts/parity-check.mjs 30 --json
import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { runBot } from './bot.mjs';

const classes = ['marine', 'tech', 'scout', 'eng'];
const json = process.argv.includes('--json');
const one = process.argv.indexOf('--one');

if (one > 0) {
  const i = Number(process.argv[one + 1]);
  const m = new Map();
  globalThis.localStorage = { getItem: k => (m.has(k) ? m.get(k) : null), setItem: (k, v) => m.set(k, String(v)), removeItem: k => m.delete(k) };
  const errors = [];
  process.on('uncaughtException', e => errors.push(e.stack || String(e)));
  process.on('unhandledRejection', e => errors.push((e && e.stack) || String(e)));
  const game = await import('../src/core/game.js');
  game.timing.scale = 0;
  game.startRun('T' + i, classes[i % 4]);
  const S = game.S;
  const r = await runBot({
    G: () => S.G, busy: () => S.busy, REACH: () => S.REACH, VIS: () => S.VIS,
    tileClick: game.tileClick, stepPlayer: game.stepPlayer, fireButton: game.fireButton, endTurn: game.endTurn,
    useItem: game.useItem, ability: game.ability, shootTargets: game.shootTargets, takePerk: game.takePerk,
  }, () => new Promise(res => setTimeout(res, 1)));
  r.errors = errors;
  process.stdout.write(JSON.stringify(r) + '\n');
  process.exit(0);
}

const runs = Number(process.argv[2] || 9);
let failed = 0;
for (let i = 0; i < runs; i++) {
  const out = spawnSync(process.execPath, [fileURLToPath(import.meta.url), '--one', String(i)], { encoding: 'utf8' });
  let r;
  try { r = JSON.parse(out.stdout.trim().split('\n').pop()); } catch { r = { seed: 'T' + i, cls: classes[i % 4], over: false, errors: [out.stderr || 'keine Ausgabe'] }; }
  if (r.errors.length || !r.over) failed++;
  if (json) console.log(JSON.stringify(r));
  else console.log(`${r.over ? (r.win ? 'entkommen' : 'Ende') : 'HÄNGT'} · Seed ${r.seed} · ${r.cls} · Raum ${r.room} · Runden ${r.rounds}${r.errors.length ? ' · FEHLER: ' + r.errors[0] : ''}`);
}
if (!json) console.log(failed ? `${failed} von ${runs} Runs mit Problemen.` : `Alle ${runs} Runs ohne Fehler.`);
process.exit(failed ? 1 : 0);
