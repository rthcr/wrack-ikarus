---
name: playtest
description: Spielt Wrack Ikarus im Browser über Chrome DevTools MCP an – startet einen Run, spielt einige Züge, prüft Konsole, Speicherstand und Mobil-Layout und liefert einen kurzen Testbericht mit Screenshots.
disable-model-invocation: true
argument-hint: "[Seed] [Fokus, z. B. 'mobil' oder 'Kampf']"
---

# Playtest: Wrack Ikarus

Teste das Spiel im echten Browser mit den `mcp__chrome-devtools__*`-Tools. Ändere dabei **keinen** Code – nur beobachten und berichten.

Das Spiel ist ein Vite-Projekt (Phaser für das Spielfeld). Es läuft nicht über `file://`, sondern über einen lokalen Server:

- Falls nötig `npm install`, dann `npm run build` und `npm run preview -- --port 4173 --strictPort` im Hintergrund starten.
- Testadresse: `http://localhost:4173/` (die klassische Fassung liegt unter `http://localhost:4173/classic/`).
- Am Ende den Preview-Server wieder beenden.
- Spielzustand lesen: `window.__wrack.S.G` (Run), `window.__wrack.S.screen`, `window.__wrack.S.VIS`.

Argumente: `$ARGUMENTS` (optional: Seed mit 3–10 Zeichen [A-Za-z0-9] und/oder Testfokus).

## Ablauf

1. **Laden** – `new_page` mit `http://localhost:4173/` (bei angegebenem Seed: `http://localhost:4173/#seed-<SEED>`). `list_console_messages` prüfen: Es dürfen keine Fehler auftreten (Ausnahme siehe „Erwartete Konsolenfehler“).
2. **Titelbildschirm** – `take_snapshot`: Seed-Feld, Klassenwahl und „Mission starten“ müssen vorhanden sein. Einmal „Würfeln“ (`#rollBtn`) klicken, die Seed-Vorschau muss sich ändern. Screenshot.
3. **Run starten** – `#startBtn` klicken oder Enter drücken. Screenshot vom Spielfeld.
4. **Spielen (ca. 15–25 Eingaben)** – mit `press_key` bewegen (WASD/QEZC, Pfeiltasten), `F` = Schießen (Ziel auf dem Spielfeld-Canvas `#cv` anklicken, `Escape` bricht ab), `R` = Fähigkeit, `1`–`6` = Gegenstand, `Space` = Zug beenden. Auch das Touch-Pad (`.pad button`) und `#endBtn` mindestens einmal per `click` verwenden. Nach jeder Handvoll Züge Konsole prüfen und den Spielzustand per `evaluate_script` lesen, wenn möglich (z. B. Text der Statuskonsole oder des Logs).
5. **Speicherstand** – `evaluate_script`: `Object.keys(localStorage)` und den Inhalt der Schlüssel ausgeben (`wrack-ikarus-bestenliste-v2`, `wrack-ikarus-ton`, `wrack-ikarus-lp`, `wrack-ikarus-run-v4`). Über `#setBtn` das Menü öffnen, Musik-Regler verstellen und Effekte stumm schalten (`#sfxMute`), Seite neu laden (`navigate_page` reload) und prüfen, ob die Einstellungen erhalten bleiben (`wrack-ikarus-lautstaerke`, `wrack-ikarus-ton`, `wrack-ikarus-musik`) und der laufende Run mit gleicher Runde, Position und TP fortgesetzt wird.
6. **Run-Ende** – `#quitBtn` zweimal klicken (Bestätigung). Nach ca. 1,2 s erscheint der Ergebnisbildschirm „Abgebrochen in Raum N“ mit Share-Text; ein Abbruch darf **keinen** Bestenlisten-Eintrag erzeugen, das Namensfeld (`#submitBox`) ist ausgeblendet und `wrack-ikarus-run-v4` ist gelöscht. Danach „Gleicher Seed, neuer Versuch“ (`#againBtn`) prüfen.
7. **Mobil** – `emulate` bzw. `resize_page` auf ca. 390×844. Das Layout muss gestapelt sein, nichts darf horizontal überlaufen (`document.documentElement.scrollWidth <= innerWidth`) und das Touch-Pad muss bedienbar sein. Screenshot.
8. **Aufräumen** – Testseite schließen (`close_page`).

Liegt ein Fokus vor (z. B. „mobil“, „Kampf“, „Speichern“), diesen Teil ausführlicher testen und andere Schritte kürzer halten.

## Erwartete Konsolenfehler

Lokal mit `npm run preview` gibt es weder die Vercel-Analytics noch die API der gemeinsamen Bestenliste. Diese Fehler sind erwartet und **kein** Befund:

- `Failed to load resource: the server responded with a status of 404` für `/_vercel/insights/script.js`
- `404` für `/api/scores`
- Warnung `The AudioContext was not allowed to start …`: Chrome sperrt Ton bis zum ersten Klick, das Spiel zeigt dann den Knopf „Ton einschalten“

Die gemeinsame Bestenliste (`#gsTitle`, `#gsEnd`) zeigt dann „Die gemeinsame Bestenliste ist hier gerade nicht erreichbar.“, auch das ist korrekt. Das Eintragen eines Namens lässt sich lokal nicht testen. Alle anderen Fehler und Warnungen melden.

## Bericht

Kurz und auf Deutsch:

- **Ergebnis:** ✅ ok / ⚠️ Auffälligkeiten / ❌ Fehler
- **Konsole:** Fehler und Warnungen mit Datei und Zeile (im Build sind das gebündelte Dateien unter `assets/`; zum Eingrenzen `npm run dev` nutzen, dort stimmen die Pfade unter `src/`)
- **Befunde:** pro Punkt: Schritt, erwartet, beobachtet, ggf. Screenshot
- **Gespielter Seed** (damit der Run reproduzierbar ist)

Keine Fixes vorschlagen, ohne die Ursache im Code geprüft zu haben. Fixes nur auf ausdrückliche Nachfrage umsetzen.
