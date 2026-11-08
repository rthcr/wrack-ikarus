// Einfacher Test-Bot: spielt einen Run so lange, bis er endet oder maxSteps erreicht sind.
// Er läuft auf dem kürzesten Weg zu Gegnern, schießt, heilt sich und nimmt immer das erste Upgrade.
// api: { G(), busy(), REACH(), VIS(), tileClick, stepPlayer, fireButton, endTurn, useItem, shootTargets, takePerk }
import { canStep } from '../src/core/geometry.js';
const RW = 17;
const cheb = (a, b) => Math.max(Math.abs(a.x - b.x), Math.abs(a.y - b.y));

// Wegstrecke von einem Feld aus über begehbare Felder (wie Spieler und Gegner laufen, Gegner zählen nicht als Hindernis).
// Damit läuft der Bot um Kisten herum, statt in Luftlinie hängen zu bleiben.
function walkDist(map, from) {
  const d = new Int16Array(map.length).fill(-1); const s = from.x + from.y * RW; d[s] = 0; const q = [s];
  for (let qi = 0; qi < q.length; qi++) {
    const i = q[qi], x = i % RW, y = (i / RW) | 0;
    for (let dx = -1; dx <= 1; dx++) for (let dy = -1; dy <= 1; dy++) {
      if (!dx && !dy) continue; const nx = x + dx, ny = y + dy, j = nx + ny * RW;
      if (nx < 0 || ny < 0 || nx >= RW || j >= map.length || d[j] >= 0 || !canStep(map, x, y, nx, ny)) continue;
      d[j] = d[i] + 1; q.push(j);
    }
  }
  return d;
}

// human: wie ein Mensch das automatische Zugende abwarten, statt selbst „Zug beenden“ zu drücken
export async function runBot(api, wait, maxSteps = 4000, human = false) {
  let steps = 0, maxRoom = 1;
  while (steps++ < maxSteps) {
    await wait();
    const G = api.G();
    if (!G || G.over) break;
    if (api.busy() || G.phase === 'enemy') continue;
    if (G.offer) { api.takePerk(0); continue; }
    maxRoom = Math.max(maxRoom, G.room);
    const p = G.p, R = api.REACH(), V = api.VIS();
    const alive = G.mons.filter(m => m.hp > 0);
    if (G.phase === 'player') {
      const mi = p.inv.indexOf('med');
      // Medi zweimal wählen, weil er bei kleiner Heilung nachfragt
      if (p.act > 0 && mi >= 0 && p.hp < p.max * .35) { api.useItem(mi); if (G.p.act > 0) api.useItem(mi); continue; }
      const adj = alive.find(m => V[m.x + m.y * RW] && cheb(m, p) === 1);
      if (p.act > 0 && adj) { const before = p.act; api.stepPlayer(Math.sign(adj.x - p.x), Math.sign(adj.y - p.y)); if (p.act === before) api.endTurn(); continue; }
      if (p.act > 0 && api.shootTargets().length && (p.ammo > 0 || G.cls === 'scout')) { const before = p.act; api.fireButton(true); if (p.act === before) api.endTurn(); continue; }
      if (p.mp > 0) {
        const vis = alive.filter(m => V[m.x + m.y * RW]); const tgt = vis[0] || alive[0];
        if (tgt) {
          // Ziel: erreichbares Feld mit kürzestem echtem Weg zum Gegner (nicht das Gegnerfeld selbst)
          const D = walkDist(G.map, tgt); let best = -1, bd = D[p.x + p.y * RW]; if (bd < 0) bd = 9999;
          for (let i = 0; i < R.length; i++) { if (R[i] <= 0 || D[i] < 1) continue; if (D[i] < bd) { bd = D[i]; best = i; } }
          if (best >= 0) { api.tileClick(best % RW, (best / RW) | 0); continue; }
        }
      }
      if (human && p.mp <= 0 && p.act <= 0) continue;
      api.endTurn(); continue;
    }
    if (G.phase === 'explore') {
      const it = G.items.find(i => R[i.x + i.y * RW] > 0 && p.inv.length < 6);
      if (it) { api.tileClick(it.x, it.y); continue; }
      let ex = null; for (let i = 0; i < G.map.length; i++) if (G.map[i] === 4 || (G.map[i] === 5 && G.bossDead)) { ex = i; break; }
      if (ex != null) { api.tileClick(ex % RW, (ex / RW) | 0); continue; }
    }
  }
  const G = api.G();
  return {
    seed: G.seed, cls: G.cls, room: G.room, maxRoom, win: G.win, over: G.over, alive: G.alive, rounds: G.rounds,
    kills: G.kills, xp: G.xpTotal, lvl: G.p.lvl, hp: G.p.hp, ammo: G.p.ammo, inv: G.p.inv.join('+'), path: G.path,
    cause: G.cause, logs: G.log.length, lastLog: G.log[0] && G.log[0].t, steps,
  };
}
