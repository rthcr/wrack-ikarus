# Wrack Ikarus

Sci-Fi-Roguelike im Browser (Deutsch und Englisch, Umschalter oben rechts). Rundenbasiert: 8 Kampfräume, dann die Brutkammer mit Boss.
Live auf Vercel, Code auf GitHub (`rthcr/wrack-ikarus`). Sprache in Code-Kommentaren, Texten und Commits: Deutsch.

## Befehle

- `npm install` – Abhängigkeiten (Phaser, Vite)
- `npm run dev` – Entwicklungsserver mit Live-Reload
- `npm run build` – Produktionsbuild nach `dist/` (macht Vercel automatisch)
- `npm run preview` – den Build lokal ansehen
- `npm run check` – Test-Bot spielt 9 Runs direkt gegen die Spiellogik und meldet Abstürze oder hängende Runs
- `python3 scripts/audio/generate.py [name …]` – Soundeffekte und Musik neu erzeugen (braucht numpy, scipy, ffmpeg); ohne Namen alles
- `python3 scripts/icons/make-icons.py` – Favicon (Helm) und Apple-Touch-Icon neu erzeugen (braucht Pillow)
- `node scripts/og/make-og.mjs` – Vorschaubild für geteilte Links `public/og.png` aus der Titelszene (braucht Playwright)

## Aufbau

```
index.html            Seitengerüst (Titel, Spiel, Ende); lädt src/main.js
src/main.js           Einstieg: Phaser starten, Module verbinden, gespeicherten Run fortsetzen
src/style.css         Gestaltung der Oberfläche
src/core/             Spiellogik, OHNE DOM und OHNE Phaser (läuft auch in Node, siehe npm run check)
  config.js           Konstanten und Datentabellen (Klassen, Gegner, Items)
  rng.js              Seed-Zufall (deterministisch)
  geometry.js         Sichtlinien, Schrittprüfung
  roomgen.js          Raumgenerator
  storage.js          localStorage: Bestenliste, LP, Run, Name, Ton/Musik an-aus, Lautstärken, Bildfilter
  bus.js              Ereignis-Bus zwischen Logik und Darstellung
  i18n.js             Sprache de/en: L('deutsch','english'), nf() für Zahlen, localize() für Datentabellen
  game.js             Regeln, Runden, Kampf, Items, Gegner-KI
src/render/           Darstellung
  GameScene.js        Phaser-Szene: Raum, Figuren (gleiten, hüpfen, Ausfallschritt), Licht und Dunkelheit,
                      Markierungen, Partikel, Kamerawackeln
  art.js              Pixel-Art 16×16 als Zeichenketten (Figuren, Gegner, Items), Palette PAL
  sprites.js          malt art.js auf Canvas, erzeugt die 2. Animationsphase (Atmen/Schweben/Blinken), TS = 16
  tiles.js            Kacheln in 16×16 (Böden je Deck, Wände, Kisten, Konsolen, Türen, Kapsel) und ihre Lichtquellen
  titleScene.js       Titelbild „Station im Orbit“ (eigenständig, ohne Importe; auch für og.png genutzt)
src/ui/               DOM-Oberfläche: lang.js (Sprachwahl, englische Texte für index.html), hud.js (Statuskonsole), screens.js (Titel/Ende/Bestenlisten), input.js (Tastatur, Knöpfe),
                      settings.js (Menü Einstellungen: Lautstärke/Stumm Musik und Effekte, Bildfilter; Knopf „Ton einschalten“),
                      titleArt.js (animiert das Titelbild, nur solange der Startbildschirm sichtbar ist),
                      controls.js (Steuerungstabelle, füllt alle [data-controls]: Startbildschirm und aufklappbar im Spiel),
                      fullscreen.js (Knopf „Vollbild“; nur sichtbar, wenn der Browser es kann – iPhone nicht)
src/audio/engine.js   Web-Audio: Dateien laden, Effekte abspielen, Musikspuren überblenden (nahtlose Loops)
src/audio/sfx.js      Ton im Spiel: Effekte zu Ereignissen, Musik ab Startbildschirm je Deck + Kampfspur, Lautstärken
public/assets/audio/  erzeugte MP3s und manifest.json (nicht von Hand bearbeiten, sondern neu erzeugen)
scripts/audio/        generate.py: synthetischer Klang-Generator für alle Effekte und die Musik
public/               favicon.svg, favicon-32/48.png, apple-touch-icon.png, og.png (erzeugt, siehe Befehle)
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
- Grafik: Kacheln sind 16×16 (`TS`), die Welt 272×208 Pixel, Phaser skaliert mit `pixelArt: true`.
  Neue Figuren in `art.js`: genau 16 Zeilen à 16 Zeichen, nur Farbzeichen aus `PAL` (plus h/H bzw. x/X zum Umfärben).
  Kein Bloom/Weichzeichner über die ganze Kamera, das macht die Pixel matschig; Leuchten läuft über die additiven Lichtkreise.
- Schriften: Pixelschrift Silkscreen (`--f-display`) für Überschriften und Bedienelemente, IBM Plex Mono für Text;
  der Schriftzug „Wrack Ikarus“ (Titel, Logo, og.png) nutzt `--f-title` = Big Shoulders Stencil, selbst gehostet in `public/fonts/`.
- Licht: `AMBIENT` in GameScene.js ist die Grunddunkelheit. Lichtquellen sind Objekte `{x,y,r,col,i}`.
  Der Schalter „Bildfilter“ (localStorage `wrack-ikarus-filter`) steuert kräftiges Leuchten und die Scanlines (`.stage.crt`).
- Ton: Effekt-Namen sind die `SFX.*`-Aufrufe in game.js (z. B. `shoot`, `hit`, `boom`). Neuer Effekt = Funktion in
  `scripts/audio/generate.py` + Eintrag in `SFX` dort + Lautstärke in `VOL` (sfx.js). Fehlt eine Datei, spielt ein Ersatzton.
- Musik: alles in A. Loops müssen ein Vielfaches von 1152 Samples lang sein (MP3-Block), sonst knackt die Schleife;
  jede Datei hat 1 s Puffer davor/dahinter (`pad` im Manifest), geloopt wird nur der Mittelteil.
  Die Kampfspur kommt dazu, sobald ein Gegner im Raum `aware` ist (siehe `target()` in sfx.js).
- Bewegung: `SFX.step()` bei jedem Schritt der Spielfigur, `emit('sfx','move',typ)` bei sichtbaren Gegnerschritten;
  welcher Klang zu welchem Gegner gehört, steht in `MOVE` (sfx.js).
- Browser sperren Ton bis zum ersten Klick. Die Engine startet trotzdem beim Laden und plant die Musik ein;
  hörbar wird sie, sobald der Browser es erlaubt. Chrome meldet dabei „AudioContext was not allowed to start“ (Warnung, erwartet).
  iOS/iPadOS: Zustand kann auch „interrupted“ sein (nicht nur „suspended“), freigeschaltet wird erst beim Loslassen
  (touchend/click) – siehe `resume()` in engine.js und die Ereignisliste am Ende von sfx.js.
- Spielfeldgröße: `fit()` in main.js misst die Höhe über `100svh` und ignoriert Höhenänderungen unter 120 px,
  damit das Feld beim Scrollen auf iPad/iPhone (ein- und ausfahrende Leisten) nicht springt.
- **Sprache:** Jeden sichtbaren Text gibt es auf Deutsch und Englisch. Im Code `L('…','…')` aus `core/i18n.js`;
  Namen in config.js (Klassen, Gegner, Items, Räume) haben ihr Englisch in `EN` dort, Upgrades in game.js über `localize`.
  Feste Texte in index.html bekommen `data-t="schlüssel"` (bzw. `data-t-aria`, `data-t-ph`) und den englischen Text in `EN` in `ui/lang.js`.
  Beim Umschalten kommt das Ereignis `lang`; Module, die Text zeichnen, hören darauf. Link mit `?lang=en` öffnet Englisch.
  Startsprache: gespeicherte Wahl (`wrack-ikarus-lang`), sonst Browsersprache. Die klassische Fassung bleibt deutsch.
- Steuerung: Neue Taste oder Bedienung immer auch in `ROWS` in `src/ui/controls.js` eintragen. Elemente mit Klasse `.desk`
  sind auf Touch-Geräten und unter 860 px Breite ausgeblendet.
- Fremde Grafiken, Sounds oder Musik nach `public/assets/` legen und mit Quelle und Lizenz in `CREDITS.md` eintragen.

## Hooks

- Nach jeder Datei-Änderung prüft `.claude/hooks/check-syntax.mjs` die Syntax (JS-Module und Inline-Skripte in HTML).
- Beim Beenden baut `.claude/hooks/smoke-test.mjs` das Spiel, startet es in Headless-Chrome und meldet Laufzeitfehler.
- `/playtest` spielt das Spiel über Chrome DevTools an und schreibt einen Testbericht.
