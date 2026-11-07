// Einfacher Test-Bot: spielt einen Run so lange, bis er endet oder maxSteps erreicht sind.
// Er stürmt auf Gegner zu, schießt, heilt sich und nimmt immer das erste Upgrade.
// api: { G(), busy(), REACH(), VIS(), tileClick, stepPlayer, fireButton, endTurn, useItem, shootTargets, takePerk }
const RW = 17;
const cheb = (a, b) => Math.max(Math.abs(a.x - b.x), Math.abs(a.y - b.y));

export async function runBot(api, wait, maxSteps = 4000) {
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
          let best = -1, bd = cheb(tgt, p);
          for (let i = 0; i < R.length; i++) { if (R[i] <= 0) continue; const x = i % RW, y = (i / RW) | 0; const d = cheb(tgt, { x, y }); if (d >= 1 && d < bd) { bd = d; best = i; } }
          if (best >= 0) { api.tileClick(best % RW, (best / RW) | 0); continue; }
        }
      }
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
