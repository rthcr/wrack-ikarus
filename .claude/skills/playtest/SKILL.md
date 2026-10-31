---
name: playtest
description: Spielt Wrack Ikarus im Browser über Chrome DevTools MCP an – startet einen Run, spielt einige Züge, prüft Konsole, Speicherstand und Mobil-Layout und liefert einen kurzen Testbericht mit Screenshots.
disable-model-invocation: true
argument-hint: "[Seed] [Fokus, z. B. 'mobil' oder 'Kampf']"
---

# Playtest: Wrack Ikarus

Teste `index.html` im echten Browser mit den `mcp__chrome-devtools__*`-Tools. Ändere dabei **keinen** Code – nur beobachten und berichten.

Argumente: `$ARGUMENTS` (optional: Seed mit 3–10 Zeichen [A-Za-z0-9] und/oder Testfokus).

## Ablauf

1. **Laden** – `new_page` mit `file://$CLAUDE_PROJECT_DIR/index.html` (bei angegebenem Seed: `…/index.html#seed-<SEED>`). `list_console_messages` prüfen: Es dürfen keine Fehler auftreten (Ausnahme siehe „Erwartete Konsolenfehler“).
2. **Titelbildschirm** – `take_snapshot`: Seed-Feld, Klassenwahl und „Mission starten“ müssen vorhanden sein. Einmal „Würfeln“ (`#rollBtn`) klicken, die Seed-Vorschau muss sich ändern. Screenshot.
3. **Run starten** – `#startBtn` klicken oder Enter drücken. Screenshot vom Spielfeld.
4. **Spielen (ca. 15–25 Eingaben)** – mit `press_key` bewegen (WASD/QEZC, Pfeiltasten), `F` = Schießen (Ziel auf dem Canvas anklicken, `Escape` bricht ab), `R` = Fähigkeit, `1`–`6` = Gegenstand, `Space` = Zug beenden. Auch das Touch-Pad (`.pad button`) und `#endBtn` mindestens einmal per `click` verwenden. Nach jeder Handvoll Züge Konsole prüfen und den Spielzustand per `evaluate_script` lesen, wenn möglich (z. B. Text der Statuskonsole oder des Logs).
5. **Speicherstand** – `evaluate_script`: `Object.keys(localStorage)` und den Inhalt der Schlüssel ausgeben (`wrack-ikarus-bestenliste-v2`, `wrack-ikarus-ton`, `wrack-ikarus-run`). `#sndBtn` umschalten, Seite neu laden (`navigate_page` reload) und prüfen, ob die Ton-Einstellung erhalten bleibt und der laufende Run mit gleicher Runde, Position und TP fortgesetzt wird.
6. **Run-Ende** – `#quitBtn` zweimal klicken (Bestätigung). Nach ca. 1,2 s erscheint der Ergebnisbildschirm „Abgebrochen in Raum N“ mit Share-Text; ein Abbruch darf **keinen** Bestenlisten-Eintrag erzeugen, das Namensfeld (`#submitBox`) ist ausgeblendet und `wrack-ikarus-run` ist gelöscht. Danach „Gleicher Seed, neuer Versuch“ (`#againBtn`) prüfen.
7. **Mobil** – `emulate` bzw. `resize_page` auf ca. 390×844. Das Layout muss gestapelt sein, nichts darf horizontal überlaufen (`document.documentElement.scrollWidth <= innerWidth`) und das Touch-Pad muss bedienbar sein. Screenshot.
8. **Aufräumen** – Testseite schließen (`close_page`).

Liegt ein Fokus vor (z. B. „mobil“, „Kampf“, „Speichern“), diesen Teil ausführlicher testen und andere Schritte kürzer halten.

## Erwartete Konsolenfehler

Lokal über `file://` gibt es weder die Vercel-Analytics noch die API der gemeinsamen Bestenliste. Diese Fehler sind erwartet und **kein** Befund:

- `Failed to load resource: net::ERR_FILE_NOT_FOUND` für `/_vercel/insights/script.js`
- CORS-Fehler bzw. `net::ERR_FAILED` für `file:///api/scores`

Die gemeinsame Bestenliste (`#gsTitle`, `#gsEnd`) zeigt dann „Die gemeinsame Bestenliste ist hier gerade nicht erreichbar.“, auch das ist korrekt. Das Eintragen eines Namens lässt sich lokal nicht testen. Alle anderen Fehler und Warnungen melden.

## Bericht

Kurz und auf Deutsch:

- **Ergebnis:** ✅ ok / ⚠️ Auffälligkeiten / ❌ Fehler
- **Konsole:** Fehler und Warnungen mit Zeilennummer in `index.html`
- **Befunde:** pro Punkt: Schritt, erwartet, beobachtet, ggf. Screenshot
- **Gespielter Seed** (damit der Run reproduzierbar ist)

Keine Fixes vorschlagen, ohne die Ursache im Code geprüft zu haben. Fixes nur auf ausdrückliche Nachfrage umsetzen.
