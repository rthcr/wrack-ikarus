# Wrack Ikarus

Sci-Fi-Roguelike im Browser (Deutsch). Rundenbasiert: 8 Kampfräume, dann die Brutkammer mit Boss.
Live auf Vercel, Code auf GitHub (`rthcr/wrack-ikarus`). Sprache in Code-Kommentaren, Texten und Commits: Deutsch.

## Befehle

- `npm install` – Abhängigkeiten (Phaser, Vite)
- `npm run dev` – Entwicklungsserver mit Live-Reload
- `npm run build` – Produktionsbuild nach `dist/` (macht Vercel automatisch)
- `npm run preview` – den Build lokal ansehen
- `npm run check` – Test-Bot spielt 9 Runs direkt gegen die Spiellogik und meldet Abstürze oder hängende Runs

## Aufbau

```
index.html            Seitengerüst (Titel, Spiel, Ende); lädt src/main.js
src/main.js           Einstieg: Phaser starten, Module verbinden, gespeicherten Run fortsetzen
src/style.css         Gestaltung der Oberfläche
src/core/             Spiellogik, OHNE DOM und OHNE Phaser (läuft auch in Node, siehe npm run check)
  config.js           Konstanten und Datentabellen (Klassen, Gegner, Items, Sprites als Zeichenketten)
  rng.js              Seed-Zufall (deterministisch)
  geometry.js         Sichtlinien, Schrittprüfung
  roomgen.js          Raumgenerator
  storage.js          localStorage: Bestenliste, LP, Run, Name, Ton
  bus.js              Ereignis-Bus zwischen Logik und Darstellung
  game.js             Regeln, Runden, Kampf, Items, Gegner-KI
src/render/           Darstellung
  GameScene.js        Phaser-Szene: Raum, Figuren mit Bewegung, Markierungen, Partikel, Kamerawackeln
  sprites.js          Pixel-Sprites aus config.js auf Canvas malen (für Phaser und die Oberfläche)
src/ui/               DOM-Oberfläche: hud.js (Statuskonsole), screens.js (Titel/Ende/Bestenlisten), input.js (Tastatur, Knöpfe)
src/audio/sfx.js      Soundeffekte (derzeit im Browser erzeugte Retro-Töne)
public/classic/       Die erste Fassung des Spiels als einzelne HTML-Datei, erreichbar unter /classic/. NICHT ändern.
api/scores.js         Vercel-Funktion für die gemeinsame Bestenliste (Upstash Redis)
scripts/              Test-Bot (bot.mjs) und npm run check (parity-check.mjs)
```

## Regeln für Änderungen

- **Logik und Darstellung getrennt halten.** `src/core/` greift nie auf `document`, `window` oder Phaser zu.
  Was sichtbar oder hörbar werden soll, meldet die Logik über `emit()` aus `bus.js`:
  `change` (Oberfläche neu zeichnen), `fx` (Effekt), `sfx` (Ton), `banner`, `hurt`, `screen`, `reset`.
- **Determinismus:** Gleicher Seed und gleiche Eingaben müssen denselben Run ergeben. Zufall im Spiel nur über `rnd()` (Kampf)
  bzw. den Raumgenerator, nie `Math.random()` in der Spiellogik.
- **Punkte:** `score()` in `src/core/game.js` und `calcScore()` in `api/scores.js` müssen gleich rechnen, sonst lehnt der Server Einträge ab.
- **Speicherschlüssel:** Bestenliste und LP teilen sich die Schlüssel mit der klassischen Fassung (Fortschritt gilt in beiden).
  Der laufende Run hat einen eigenen Schlüssel (`wrack-ikarus-run-v3`). Ändert sich die Form von `G` inkompatibel, Schlüssel hochzählen.
- Nach Logikänderungen `npm run check` laufen lassen.
- Grafiken, Sounds und Musik als Dateien nach `public/assets/` legen und mit Quelle und Lizenz in `CREDITS.md` eintragen.

## Hooks

- Nach jeder Datei-Änderung prüft `.claude/hooks/check-syntax.mjs` die Syntax (JS-Module und Inline-Skripte in HTML).
- Beim Beenden baut `.claude/hooks/smoke-test.mjs` das Spiel, startet es in Headless-Chrome und meldet Laufzeitfehler.
- `/playtest` spielt das Spiel über Chrome DevTools an und schreibt einen Testbericht.
