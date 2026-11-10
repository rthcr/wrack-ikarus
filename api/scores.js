// Gemeinsame Bestenliste für Wrack Ikarus.
// GET  /api/scores            -> Top 20 aller Zeiten
// GET  /api/scores?day=JJJJ-MM-TT -> Top 20 des Seeds des Tages
// POST /api/scores            -> neuen Run eintragen. Der Server spielt den Run aus seiner Aufzeichnung (rec) nach
//                                und trägt nur ein, was dabei herauskommt (src/core/replay.js);
//                                mit day und dem passenden Tages-Seed zusätzlich in die Tagesliste
// Speicher: Upstash Redis über die REST-API (Variablen KV_REST_API_URL / KV_REST_API_TOKEN).

const crypto = require('crypto');

const REDIS_URL = process.env.KV_REST_API_URL;
const REDIS_TOKEN = process.env.KV_REST_API_TOKEN;

const BOARD = 'wi:board';      // Sorted Set: Punkte -> Eintrags-ID
const ENTRIES = 'wi:entries';  // Hash: Eintrags-ID -> JSON
const KEEP = 200;              // so viele Einträge bleiben gespeichert
const TOP = 20;                // so viele liefert GET aus
const PER_MINUTE = 5;          // Einträge pro Minute und Anschluss
const ROOMS = 9;
const DAY_TTL = 8 * 24 * 3600; // Tageslisten werden nach 8 Tagen gelöscht
const dayBoard = (d) => 'wi:day:' + d;          // Sorted Set je Tag
const dayEntries = (d) => 'wi:day:' + d + ':e'; // Hash je Tag (eigene Kopie, unabhängig vom Kürzen der Gesamtliste)
const CLASSES = ['marine', 'tech', 'scout', 'eng'];

async function redis(commands) {
  const res = await fetch(`${REDIS_URL}/pipeline`, {
    method: 'POST',
    headers: { Authorization: `Bearer ${REDIS_TOKEN}`, 'Content-Type': 'application/json' },
    body: JSON.stringify(commands),
  });
  if (!res.ok) throw new Error(`Redis antwortet mit ${res.status}`);
  const out = await res.json();
  return out.map((r) => {
    if (r.error) throw new Error(r.error);
    return r.result;
  });
}

// Muss mit score() im Spiel übereinstimmen.
function calcScore(e) {
  return e.xp * 10 + e.cleared * 150 + (e.win ? 2500 + Math.max(0, 1500 - e.rounds * 12) : 0);
}

const isInt = (v, min, max) => Number.isInteger(v) && v >= min && v <= max;

// Nachspielen: Die Spiellogik ist ein einzelnes Modul mit globalem Zustand, daher immer nur ein Run gleichzeitig.
let replayModule = null, queue = Promise.resolve();
function replay(run) {
  const job = queue.then(async () => {
    if (!replayModule) replayModule = await import('../src/core/replay.js');
    return replayModule.replayRun(run);
  });
  queue = job.catch(() => {});
  return job;
}
const SAME = ['seed', 'cls', 'win', 'room', 'cleared', 'rounds', 'kills', 'lvl', 'xp'];

// Seed des Tages. Muss mit dailySeed() in src/core/rng.js übereinstimmen.
const ALPH = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
function h32(s) { let h = 2166136261 >>> 0; for (let i = 0; i < s.length; i++) { h ^= s.charCodeAt(i); h = Math.imul(h, 16777619); } return h >>> 0; }
function dailySeed(day) { let s = ''; for (let i = 0; i < 6; i++) s += ALPH[h32('wrack-ikarus-tag:' + day + ':' + i) % ALPH.length]; return s; }
const dayKey = (d) => d.toISOString().slice(0, 10);
const isDayFormat = (d) => typeof d === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(d);
// Heute oder gestern (UTC): Ein Run, der kurz vor Mitternacht beginnt, zählt noch für seinen Tag.
function acceptDay(day, seed) {
  if (!isDayFormat(day)) return null;
  const now = new Date(), ok = [dayKey(now), dayKey(new Date(now.getTime() - 864e5))];
  return ok.includes(day) && dailySeed(day) === seed ? day : null;
}

function validate(b) {
  if (!b || typeof b !== 'object') return 'Ungültige Daten.';
  const name = (typeof b.name === 'string' ? b.name : '')
    .normalize('NFC')
    .replace(/[\u0000-\u001f\u007f-\u009f<>]/g, '')
    .replace(/\s+/g, ' ')
    .trim()
    .slice(0, 16);
  if (!name) return 'Bitte gib einen Namen ein.';
  const seed = typeof b.seed === 'string' ? b.seed.toUpperCase() : '';
  if (!/^[A-Z0-9]{1,10}$/.test(seed)) return 'Ungültiger Seed.';
  if (!CLASSES.includes(b.cls)) return 'Ungültige Klasse.';
  const win = b.win === true;
  if (!isInt(b.room, 1, ROOMS) || !isInt(b.cleared, 0, ROOMS) || !isInt(b.rounds, 0, 20000) ||
      !isInt(b.kills, 0, 20000) || !isInt(b.lvl, 1, 99) || !isInt(b.xp, 0, 200000)) return 'Ungültige Werte.';
  // Plausibilität: grobe Obergrenzen, die ein echter Run nicht reißt.
  if (win && (b.room !== ROOMS || b.cleared !== ROOMS)) return 'Dieser Run ist nicht plausibel.';
  if (!win && (b.cleared < b.room - 1 || b.cleared > b.room)) return 'Dieser Run ist nicht plausibel.';
  if (b.rounds < b.cleared) return 'Dieser Run ist nicht plausibel.';
  if (b.xp > 120 * b.room + b.rounds) return 'Dieser Run ist nicht plausibel.';
  if (b.kills > 15 * b.room + b.rounds) return 'Dieser Run ist nicht plausibel.';
  const e = { name, seed, cls: b.cls, win, room: b.room, cleared: b.cleared, rounds: b.rounds, kills: b.kills, lvl: b.lvl, xp: b.xp };
  e.score = calcScore(e);
  e.day = acceptDay(b.day, seed);
  return e;
}

async function topList(board = BOARD, entries = ENTRIES) {
  const [ids] = await redis([['ZREVRANGE', board, '0', String(TOP - 1)]]);
  if (!ids || !ids.length) return [];
  const [rows] = await redis([['HMGET', entries, ...ids]]);
  return rows
    .map((r) => {
      try {
        const e = JSON.parse(r);
        return { id: e.id, name: e.name, score: e.score, cls: e.cls, seed: e.seed, room: e.room, win: e.win, rounds: e.rounds, kills: e.kills, lvl: e.lvl, date: e.date };
      } catch (err) {
        return null;
      }
    })
    .filter(Boolean);
}

// Client-IP: Vercel setzt diese Kopfzeilen selbst und überschreibt, was der Browser schickt (Schutz gegen gefälschte IPs).
function clientKey(req) {
  const h = req.headers;
  const ip = String(h['x-vercel-forwarded-for'] || h['x-real-ip'] || h['x-forwarded-for'] || 'unbekannt').split(',')[0].trim();
  return 'wi:rl:' + crypto.createHash('sha256').update(ip).digest('hex').slice(0, 16);
}

module.exports = async function handler(req, res) {
  res.setHeader('Cache-Control', 'no-store');
  // Die itch.io-Fassung läuft auf einer fremden Adresse (html-classic.itch.zone) und fragt hier an.
  // Ohne Cookies oder Anmeldung ist „*“ unbedenklich: Eintragen kann man ohnehin nur geprüfte Runs.
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
  res.setHeader('Access-Control-Max-Age', '86400');
  if (req.method === 'OPTIONS') { res.status(204).end(); return; }
  if (!REDIS_URL || !REDIS_TOKEN) {
    res.status(500).json({ error: 'Die Datenbank ist nicht mit dem Projekt verbunden.' });
    return;
  }
  try {
    if (req.method === 'GET') {
      let day = req.query && req.query.day;
      if (day === undefined) { try { day = new URL(req.url, 'http://x').searchParams.get('day'); } catch (err) { day = null; } }
      if (day) {
        if (!isDayFormat(day)) { res.status(400).json({ error: 'Ungültiges Datum.' }); return; }
        res.status(200).json({ day, seed: dailySeed(day), scores: await topList(dayBoard(day), dayEntries(day)) });
        return;
      }
      res.status(200).json({ scores: await topList() });
      return;
    }
    if (req.method === 'POST') {
      let body = req.body;
      if (typeof body === 'string') {
        try { body = JSON.parse(body); } catch (err) { body = null; }
      }
      const key = clientKey(req);
      // Hochzählen (atomar in Redis) und bei jeder Anfrage die Ablaufzeit neu setzen: Es bleibt nie ein Zähler
      // ohne Ablaufzeit übrig. Wer weiter sendet, verlängert seine Sperre; nach 60 s Ruhe ist der Zähler weg.
      const [count] = await redis([['INCR', key], ['EXPIRE', key, '60']]);
      if (count > PER_MINUTE) {
        res.status(429).json({ error: 'Zu viele Einträge. Versuch es in einer Minute nochmal.' });
        return;
      }
      const e = validate(body);
      if (typeof e === 'string') {
        res.status(400).json({ error: e });
        return;
      }
      // Run nachspielen: Nur was dabei wirklich herauskommt, darf in die Liste
      if (!Array.isArray(body.rec)) {
        res.status(400).json({ error: 'Dieser Run kann nicht geprüft werden.' });
        return;
      }
      const t0 = Date.now();
      const r = await replay({ seed: e.seed, cls: e.cls, lp0: body.lp0, day: isDayFormat(body.day) ? body.day : null, rec: body.rec });
      const diff = r.ok ? SAME.filter((k) => r.entry[k] !== e[k]) : [];
      if (!r.ok || diff.length) {
        console.warn('Run abgelehnt', e.seed, e.cls, r.ok ? diff.map((k) => `${k}: ${e[k]} ≠ ${r.entry[k]}`).join(', ') : r.reason, `${Date.now() - t0} ms`);
        // In der Vorschau-Version den Grund mitschicken, damit Testläufe sich auswerten lassen
        const why = process.env.VERCEL_ENV === 'preview' ? ' [' + (r.ok ? diff.map((k) => `${k} ${e[k]}≠${r.entry[k]}`).join(', ') : r.reason) + ']' : '';
        res.status(400).json({ error: 'Dieser Run ist nicht plausibel.' + why });
        return;
      }
      const id = Date.now().toString(36) + crypto.randomBytes(3).toString('hex');
      const entry = { id, ...e, date: new Date().toISOString() };
      if (!entry.day) delete entry.day;
      const [, , rank, total] = await redis([
        ['HSET', ENTRIES, id, JSON.stringify(entry)],
        ['ZADD', BOARD, String(e.score), id],
        ['ZREVRANK', BOARD, id],
        ['ZCARD', BOARD],
      ]);
      if (total > KEEP) {
        const cut = String(total - KEEP - 1);
        const [old] = await redis([['ZRANGE', BOARD, '0', cut]]);
        if (old.length) await redis([['ZREMRANGEBYRANK', BOARD, '0', cut], ['HDEL', ENTRIES, ...old]]);
      }
      // Seed des Tages: zusätzlich in die Tagesliste
      let daily = null;
      if (e.day) {
        const b = dayBoard(e.day), h = dayEntries(e.day);
        const [, , , , dRank, dTotal] = await redis([
          ['HSET', h, id, JSON.stringify(entry)],
          ['ZADD', b, String(e.score), id],
          ['EXPIRE', h, String(DAY_TTL)],
          ['EXPIRE', b, String(DAY_TTL)],
          ['ZREVRANK', b, id],
          ['ZCARD', b],
        ]);
        if (dTotal > KEEP) {
          const cut = String(dTotal - KEEP - 1);
          const [old] = await redis([['ZRANGE', b, '0', cut]]);
          if (old.length) await redis([['ZREMRANGEBYRANK', b, '0', cut], ['HDEL', h, ...old]]);
        }
        daily = { day: e.day, rank: dRank + 1, total: dTotal, scores: await topList(b, h) };
      }
      res.status(201).json({ id, rank: rank + 1, total, score: e.score, scores: await topList(), daily });
      return;
    }
    res.setHeader('Allow', 'GET, POST, OPTIONS');
    res.status(405).json({ error: 'Nur GET und POST sind erlaubt.' });
  } catch (err) {
    console.error(err);
    res.status(502).json({ error: 'Die Bestenliste ist gerade nicht erreichbar.' });
  }
};
