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

1. **Laden** – `new_page` mit `file://$CLAUDE_PROJECT_DIR/index.html` (bei angegebenem Seed: `…/index.html#seed-<SEED>`). `list_console_messages` prüfen: Es dürfen keine Fehler auftreten.
2. **Titelbildschirm** – `take_snapshot`: Seed-Feld, Klassenwahl und „Mission starten“ müssen vorhanden sein. Einmal „Würfeln“ (`#rollBtn`) klicken, die Seed-Vorschau muss sich ändern. Screenshot.
3. **Run starten** – `#startBtn` klicken oder Enter drücken. Screenshot vom Spielfeld.
4. **Spielen (ca. 15–25 Eingaben)** – mit `press_key` bewegen (WASD/QEZC, Pfeiltasten), `F` = Schießen (Ziel auf dem Canvas anklicken, `Escape` bricht ab), `R` = Fähigkeit, `1`–`6` = Gegenstand, `Space` = Zug beenden. Auch das Touch-Pad (`.pad button`) und `#endBtn` mindestens einmal per `click` verwenden. Nach jeder Handvoll Züge Konsole prüfen und den Spielzustand per `evaluate_script` lesen, wenn möglich (z. B. Text der Statuskonsole oder des Logs).
5. **Speicherstand** – `evaluate_script`: `Object.keys(localStorage)` und den Inhalt der Highscore- und Ton-Schlüssel ausgeben. `#sndBtn` umschalten, Seite neu laden (`navigate_page` reload) und prüfen, ob die Ton-Einstellung erhalten bleibt.
6. **Run-Ende** – `#quitBtn` zweimal klicken (Bestätigung). Der Ergebnisbildschirm muss erscheinen, ebenso der Highscore-Eintrag und der Share-Text. Danach „Gleicher Seed, neuer Versuch“ (`#againBtn`) prüfen.
7. **Mobil** – `emulate` bzw. `resize_page` auf ca. 390×844. Das Layout muss gestapelt sein, nichts darf horizontal überlaufen (`document.documentElement.scrollWidth <= innerWidth`) und das Touch-Pad muss bedienbar sein. Screenshot.
8. **Aufräumen** – Testseite schließen (`close_page`).

Liegt ein Fokus vor (z. B. „mobil“, „Kampf“, „Speichern“), diesen Teil ausführlicher testen und andere Schritte kürzer halten.

## Bericht

Kurz und auf Deutsch:

- **Ergebnis:** ✅ ok / ⚠️ Auffälligkeiten / ❌ Fehler
- **Konsole:** Fehler und Warnungen mit Zeilennummer in `index.html`
- **Befunde:** pro Punkt: Schritt, erwartet, beobachtet, ggf. Screenshot
- **Gespielter Seed** (damit der Run reproduzierbar ist)

Keine Fixes vorschlagen, ohne die Ursache im Code geprüft zu haben. Fixes nur auf ausdrückliche Nachfrage umsetzen.
