# Wrack Ikarus

Sci-Fi-Roguelike im Browser (Deutsch und Englisch, Umschalter oben rechts). Rundenbasiert: 8 Kampfräume, dann die Brutkammer mit Boss.
Live auf Vercel, Code auf GitHub (`rthcr/wrack-ikarus`). Sprache in Code-Kommentaren, Texten und Commits: Deutsch.

## Befehle

- `npm install` – Abhängigkeiten (Phaser, Vite)
- `npm run dev` – Entwicklungsserver mit Live-Reload
- `npm run build` – Produktionsbuild nach `dist/` (macht Vercel automatisch)
- `npm run preview` – den Build lokal ansehen
- `npm run build:itch` – Fassung für itch.io nach `dist-itch/` und `wrack-ikarus-itch.zip` (relative Pfade, Bestenliste über
  wrack-ikarus.vercel.app, ohne Vercel-Statistik und klassische Fassung); Texte und Einstellungen in `itch/beschreibung.md`,
  Bilder: `node scripts/itch/make-cover.mjs`, `node scripts/itch/make-shots.mjs`
- `npm run check` – Test-Bot spielt 9 Runs direkt gegen die Spiellogik und meldet Abstürze oder hängende Runs
  (mehr Runs: `node scripts/parity-check.mjs 100`)
- `npm run check:replay` – Bot spielt 30 Runs mit zufälligem Neuladen, jeder Run wird aus seiner Aufzeichnung nachgespielt;
  Original und Nachspielen müssen übereinstimmen (Pflicht nach jeder Logikänderung)
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
  rng.js              Seed-Zufall (deterministisch), Seed des Tages (dailySeed, dayKey)
  geometry.js         Sichtlinien, Schrittprüfung
  roomgen.js          Raumgenerator
  storage.js          localStorage: Bestenliste, LP, Run, Name, Ton/Musik an-aus, Lautstärken, Bildfilter
  bus.js              Ereignis-Bus zwischen Logik und Darstellung
  i18n.js             Sprache de/en: L('deutsch','english'), nf() für Zahlen, localize() für Datentabellen
  game.js             Regeln, Runden, Kampf, Items, Gegner-KI; zeichnet jede angenommene Eingabe in G.rec auf
  replay.js           spielt einen Run aus G.rec nach (für den Server, ohne DOM)
  achievements.js     Erfolge: Liste, Bedingungen, Vergabe
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
                      fullscreen.js (Knopf „Vollbild“; nur sichtbar, wenn der Browser es kann – iPhone nicht),
                      tutorial.js (Schritte und Texte des Tutorials, Knopf und Hinweis auf dem Startbildschirm),
                      watch.js (Wiederholung ansehen: Abspieler, Tempo, Knöpfe ▶ in den Bestenlisten)
src/audio/engine.js   Web-Audio: Dateien laden, Effekte abspielen, Musikspuren überblenden (nahtlose Loops)
src/audio/sfx.js      Ton im Spiel: Effekte zu Ereignissen, Musik ab Startbildschirm je Deck + Kampfspur, Lautstärken
public/assets/audio/  erzeugte MP3s und manifest.json (nicht von Hand bearbeiten, sondern neu erzeugen)
scripts/audio/        generate.py: synthetischer Klang-Generator für alle Effekte und die Musik
public/               favicon.svg, favicon-32/48.png, apple-touch-icon.png, og.png (erzeugt, siehe Befehle)
public/classic/       Die erste Fassung des Spiels als einzelne HTML-Datei, erreichbar unter /classic/. NICHT ändern.
api/scores.js         Vercel-Funktion für die gemeinsame Bestenliste und die Tageslisten (Upstash Redis)
scripts/              Test-Bot (bot.mjs) und npm run check (parity-check.mjs)
```

## Regeln für Änderungen

- **Veröffentlichen:** Jede fertige, getestete Änderung committen und nach `main` pushen; Vercel stellt `main` automatisch live.
  Nicht lokal oder auf einem Nebenzweig liegen lassen (Wunsch von Martin, gilt auch für alle künftigen Änderungen).

- **Logik und Darstellung getrennt halten.** `src/core/` greift nie auf `document`, `window` oder Phaser zu.
  Was sichtbar oder hörbar werden soll, meldet die Logik über `emit()` aus `bus.js`:
  `change` (Oberfläche neu zeichnen), `fx` (Effekt), `sfx` (Ton), `banner`, `hurt`, `screen`, `reset`, `watch` (Wiederholung zu Ende).
- **Determinismus:** Gleicher Seed und gleiche Eingaben müssen denselben Run ergeben. Zufall im Spiel nur über `rnd()` (Kampf)
  bzw. den Raumgenerator, nie `Math.random()` in der Spiellogik.
- **Punkte:** `score()` in `src/core/game.js` und `calcScore()` in `api/scores.js` müssen gleich rechnen, sonst lehnt der Server Einträge ab.
- **Nachspiel-Prüfung:** Der Server trägt nur Runs ein, die er aus der Aufzeichnung (`G.rec`) selbst nachspielen kann
  und die dabei genau die gemeldeten Werte ergeben. Folgen für die Spiellogik:
  - Eingaben von außen nur über die exportierten Funktionen (sie sind über `ACTIONS` aufgezeichnet). Eine neue Eingabe
    braucht ein neues Kürzel in `ACTIONS` und in `CODES` (replay.js). Interne Aufrufe nehmen die unverpackten Funktionen.
  - Nichts im Spielablauf darf von Uhrzeit, Zufall außerhalb von `rnd()`, Sprache oder Browser abhängen
    (Texte ja, Entscheidungen nein). Verzögerungen nur über `sleep`/`later` in game.js.
  - Neuladen wird als Ereignis `R` mit Prüfwert (`runHash`, ohne Log und Raumnamen) aufgezeichnet.
  - Die klassische Fassung zeichnet nicht auf; ihre Einträge lehnt der Server ab.
- **Tutorial:** `startTutorial()` in game.js baut einen festen Übungsraum (`G.tut`): keine Aufzeichnung, keine LP, kein Eintrag,
  kein gespeicherter Stand; durch die Tür oder Abbruch geht es zurück zum Start (Ereignis `tutorial`). Schritte in `ui/tutorial.js`
  beobachten nur den Zustand. Ändert sich der Raum (`TUT` in game.js), die Schritt-Texte dort prüfen.
- **Klassen:** vier (`marine`, `tech`, `scout`, `eng`) in `CLS` (config.js). Eine neue Klasse braucht außerdem: `UNLD`, `CLASS_PATCH` (art.js),
  Zweig in `ability()` und `startPerk` (game.js), `CLASSES` in `api/scores.js`, die Klassenlisten in `scripts/parity-check.mjs` und `replay-check.mjs`.
- **Geschütz und Minen:** `G.sentry` (`{x,y,ttl}`, blockiert sein Feld, schießt in `sentryTurn()` am Anfang des Gegnerzugs) und `G.mines`
  (lösen in `monTurn` nach einem Schritt aus). Beides verschwindet, wenn der Raum gesichert ist. In `enemyPhase` nach jedem `await`
  `if(G!==run)return` prüfen, sonst schießt nach einem Neuladen der alte Ablauf noch einmal (Nachspielen weicht dann ab).
- **Raum-Ereignisse:** `EVENTS` in config.js (`dark`, `coolant`, `cache`, `alarm`), gezogen in `roomgen.js` (ab Raum 2, nie im Bossraum,
  `EVENT_CHANCE`), Wirkung in game.js (`sight()`, `slow()`, `enterRoom`). Farben je Ereignis in `EVCOL` (hud.js und tiles.js gleich halten).
- **Tür-Anzeigen:** `checkClear()` erzeugt für jede Tür den nächsten Raum vorab (`genRoom` mit demselben Pfad wie beim Betreten) und legt
  `e.hint={n,elite,event,boss}` ab; tiles.js malt die Anzeige auf die Tür, hud.js listet sie unter „Gegner in Sicht“.
- **Gegner-Infos:** `monInfo()` in hud.js rechnet Schaden und Trefferchance wie `monAttack`, `melee`, `shootAt` in game.js.
  Ändern sich dort die Formeln oder kommt ein Gegner dazu, `monInfo`/`MONINFO` mitändern.
- **Seed des Tages:** für alle gleich, wechselt um Mitternacht UTC. `dailySeed()` in `src/core/rng.js` und in `api/scores.js`
  müssen gleich rechnen. Ein Run mit dem heutigen Tages-Seed bekommt `G.day`; der Server trägt ihn zusätzlich in
  `wi:day:<Datum>` ein (heute oder gestern, läuft nach 8 Tagen ab). `GET /api/scores?day=JJJJ-MM-TT` liefert die Tagesliste.
- **Erster Versuch und Serie:** Beim Seed des Tages bekommt nur der erste Versuch je Tag `G.day` (`firstDaily` in game.js, `claimDaily`
  in storage.js, Schlüssel `wrack-ikarus-tag`); weitere Versuche laufen als normaler Run. Dabei wird auch die Serie (Tage in Folge) gezählt.
  Das gilt je Browser; der Server kann es nicht prüfen.
- **Erfolge:** Liste und Bedingungen in `src/core/achievements.js`, Zähler dafür in `G.st` (`newStats` in game.js), vergeben in `finish()`.
  Gespeichert unter `wrack-ikarus-erfolge`. Neuer Zähler = Feld in `newStats` und in `validRun`.
- **Run ansehen:** Der Server hebt zu jedem Eintrag die Aufzeichnung auf (`wi:recs`, je Tag `wi:day:<Datum>:r`) und liefert sie über
  `GET /api/scores?replay=ID`. `ui/watch.js` spielt sie mit echten Wartezeiten ab. Solange `watch` in game.js gesetzt ist, bleibt der
  Browserspeicher unberührt (LP aus der Aufzeichnung, kein Eintrag, keine Erfolge), Eingaben kommen nur vom Abspieler, und das
  automatische Zugende löst der Abspieler aus (`watchAutoEnd`). **`VER` in config.js hochzählen, sobald sich der Spielablauf ändert**
  (Regeln, Werte, Raumgenerator): Ältere Aufzeichnungen passen dann nicht mehr und werden nicht mehr angeboten (`rp` im Eintrag ≠ `VER`).
- **Gespeicherter Run:** `validRun()` in game.js prüft ihn vor dem Laden vollständig; ein ungültiger wird verworfen.
  Neue Felder in `G` dort mit aufnehmen. Text aus Browserspeicher oder Server nur über `esc()` (ui/esc.js) in HTML einsetzen.
- **Speicherschlüssel:** Bestenliste und LP teilen sich die Schlüssel mit der klassischen Fassung (Fortschritt gilt in beiden).
  Der laufende Run hat einen eigenen Schlüssel (`wrack-ikarus-run-v5`). Ändert sich die Form von `G` inkompatibel, Schlüssel hochzählen.
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
- **Zwei Fassungen:** Pfade zu eigenen Dateien relativ zu `import.meta.env.BASE_URL` bzw. in HTML/CSS absolut (`/…`, Vite passt sie an);
  Adressen der eigenen Seite über `__SITE__` (leer auf Vercel, wrack-ikarus.vercel.app in der itch.io-Fassung), `__TARGET__` = web/itch.
  Die API erlaubt Anfragen von fremden Adressen (CORS), damit die itch.io-Fassung die Bestenliste nutzen kann.
- Fremde Grafiken, Sounds oder Musik nach `public/assets/` legen und mit Quelle und Lizenz in `CREDITS.md` eintragen.

## Hooks

- Nach jeder Datei-Änderung prüft `.claude/hooks/check-syntax.mjs` die Syntax (JS-Module und Inline-Skripte in HTML).
- Beim Beenden baut `.claude/hooks/smoke-test.mjs` das Spiel, startet es in Headless-Chrome und meldet Laufzeitfehler.
- `/playtest` spielt das Spiel über Chrome DevTools an und schreibt einen Testbericht.
