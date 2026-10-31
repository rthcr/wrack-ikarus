// Gemeinsame Bestenliste für Wrack Ikarus.
// GET  /api/scores  -> Top 20
// POST /api/scores  -> neuen Run eintragen (Punkte werden hier neu berechnet)
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
const CLASSES = ['marine', 'tech', 'scout'];

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
  if (!/^[A-Z0-9]{3,10}$/.test(seed)) return 'Ungültiger Seed.';
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
  return e;
}

async function topList() {
  const [ids] = await redis([['ZREVRANGE', BOARD, '0', String(TOP - 1)]]);
  if (!ids || !ids.length) return [];
  const [rows] = await redis([['HMGET', ENTRIES, ...ids]]);
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

function clientKey(req) {
  const ip = String(req.headers['x-forwarded-for'] || req.headers['x-real-ip'] || 'unbekannt').split(',')[0].trim();
  return 'wi:rl:' + crypto.createHash('sha256').update(ip).digest('hex').slice(0, 16);
}

module.exports = async function handler(req, res) {
  res.setHeader('Cache-Control', 'no-store');
  if (!REDIS_URL || !REDIS_TOKEN) {
    res.status(500).json({ error: 'Die Datenbank ist nicht mit dem Projekt verbunden.' });
    return;
  }
  try {
    if (req.method === 'GET') {
      res.status(200).json({ scores: await topList() });
      return;
    }
    if (req.method === 'POST') {
      let body = req.body;
      if (typeof body === 'string') {
        try { body = JSON.parse(body); } catch (err) { body = null; }
      }
      const key = clientKey(req);
      const [count] = await redis([['INCR', key]]);
      if (count === 1) await redis([['EXPIRE', key, '60']]);
      if (count > PER_MINUTE) {
        res.status(429).json({ error: 'Zu viele Einträge. Versuch es in einer Minute nochmal.' });
        return;
      }
      const e = validate(body);
      if (typeof e === 'string') {
        res.status(400).json({ error: e });
        return;
      }
      const id = Date.now().toString(36) + crypto.randomBytes(3).toString('hex');
      const entry = { id, ...e, date: new Date().toISOString() };
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
      res.status(201).json({ id, rank: rank + 1, total, score: e.score, scores: await topList() });
      return;
    }
    res.setHeader('Allow', 'GET, POST');
    res.status(405).json({ error: 'Nur GET und POST sind erlaubt.' });
  } catch (err) {
    console.error(err);
    res.status(502).json({ error: 'Die Bestenliste ist gerade nicht erreichbar.' });
  }
};
