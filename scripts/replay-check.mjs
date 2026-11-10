// Prüft das Nachspielen (src/core/replay.js): Der Test-Bot spielt Runs wie im Browser, lädt dabei zufällig
// „neu“ (auch mitten im Laufweg oder Gegnerzug), danach wird jeder Run aus seiner Aufzeichnung nachgespielt.
// Ergebnis von Original und Nachspielen muss übereinstimmen.
// Aufruf: node scripts/replay-check.mjs [Anzahl Runs, Standard 30]
import { runBot } from './bot.mjs';

const mem = new Map();
// Neuladen auch mitten im Ablauf (Laufweg, Gegnerzug): nach einem Speichern im nächsten Mikroschritt
let midReload = null;
const browserStorage = { getItem: k => (mem.has(k) ? mem.get(k) : null), setItem: (k, v) => { mem.set(k, String(v)); if (k === 'wrack-ikarus-run-v4' && midReload) midReload(); }, removeItem: k => mem.delete(k) };
globalThis.localStorage = browserStorage;
const game = await import('../src/core/game.js');
const { replayRun } = await import('../src/core/replay.js');
const RUNKEY = 'wrack-ikarus-run-v4';
const classes = ['marine', 'tech', 'scout', 'eng'];
const runs = Number(process.argv[2] || 30);
const human = process.argv.includes('--human');   // Zugende abwarten wie ein Mensch
const FIELDS = ['seed', 'cls', 'room', 'win', 'cleared', 'rounds', 'kills', 'lvl', 'xp', 'score'];

// eigener kleiner Zufall für die Neulade-Zeitpunkte (unabhängig vom Spiel)
let z = 12345; const rand = () => ((z = (z * 1103515245 + 12345) >>> 0) / 4294967296);

let bad = 0, reloads = 0, events = 0, ms = 0, maxSpins = 0;
for (let i = 0; i < runs; i++) {
  globalThis.localStorage = browserStorage; game.timing.scale = 0;
  const seed = 'R' + i, cls = classes[i % 4];
  game.startRun(seed, cls);
  const S = game.S; let n = 0, myReloads = 0, pending = false;
  midReload = () => {
    if (pending || !S.busy || rand() > 0.02) return;
    pending = true;
    queueMicrotask(() => { pending = false; const raw = mem.get(RUNKEY); if (raw && S.G && !S.G.over) { game.restore(JSON.parse(raw)); myReloads++; } });
  };
  await runBot({
    G: () => S.G, busy: () => S.busy, REACH: () => S.REACH, VIS: () => S.VIS,
    tileClick: game.tileClick, stepPlayer: game.stepPlayer, fireButton: game.fireButton, endTurn: game.endTurn,
    useItem: game.useItem, ability: game.ability, shootTargets: game.shootTargets, takePerk: game.takePerk,
  }, async () => {
    await new Promise(r => setTimeout(r, human ? 2 : 0));
    // gelegentlich „neu laden“: zuletzt gespeicherten Stand wie beim Seitenstart wiederherstellen
    if (++n % 9 === 0 && rand() < 0.25 && S.G && !S.G.over) {
      const raw = mem.get(RUNKEY);
      if (raw) { game.restore(JSON.parse(raw)); myReloads++; }
    }
  }, 6000, human);
  // Während eines Neuladens im Gegnerzug kann der Run gerade enden: abwarten
  for (let k = 0; k < 1000 && !(S.G && S.G.over); k++) await new Promise(r => setTimeout(r, 0));
  midReload = null;
  const orig = S.lastEntry;
  if (!orig || !S.G.over) { console.log(`HÄNGT · ${seed}`); bad++; continue; }
  if (orig.quit) continue;
  reloads += myReloads; events += orig.rec.length;
  const t0 = performance.now();
  const r = await replayRun({ seed: orig.seed, cls: orig.cls, lp0: orig.lp0, day: orig.day, rec: orig.rec });
  ms += performance.now() - t0;
  if (r.ok) maxSpins = Math.max(maxSpins, r.spins / orig.rec.length);
  const diff = r.ok ? FIELDS.filter(f => r.entry[f] !== orig[f]) : [];
  if (!r.ok || diff.length) {
    bad++;
    console.log(`ABWEICHUNG · ${seed} ${cls} · Neuladen ${myReloads} · ${r.ok ? diff.map(f => `${f}: ${orig[f]} → ${r.entry[f]}`).join(', ') : r.reason}`);
  } else console.log(`ok · ${seed} ${cls} · Raum ${orig.room}${orig.win ? ' (entkommen)' : ''} · ${orig.rec.length} Eingaben · ${myReloads}× neu geladen · LP am Start ${orig.lp0}`);
}
console.log(`\n${runs - bad} von ${runs} Runs stimmen überein · ${reloads}× neu geladen · ${events} Eingaben · Nachspielen im Schnitt ${(ms / Math.max(1, runs - bad)).toFixed(0)} ms · höchstens ${maxSpins.toFixed(0)} Rechenschritte je Eingabe`);
process.exit(bad ? 1 : 0);
