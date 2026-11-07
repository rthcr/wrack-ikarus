// Steuerungstabelle: eine Quelle, angezeigt auf dem Startbildschirm und im Spiel (aufklappbar).
// Jede Zeile: Aktion, Maus/Touch, Tastatur (HTML mit <kbd>).
// Tastengruppen bleiben zusammen (span.g), umbrechen darf nur zwischen den Gruppen
const k=(...keys)=>`<span class="g">${keys.map(x=>`<kbd>${x}</kbd>`).join('')}</span>`;
const g=s=>`<span class="g">${s}</span>`;
const ROWS=[
  ['Laufen','Feld anklicken oder antippen',`${k('↑','←','↓','→')} oder ${k('W','A','S','D')}`],
  ['Schräg laufen','Feld anklicken',`${k('Q','E','Y','C')} oder Nummernblock`],
  ['Nahkampf','angrenzenden Gegner anklicken','in den Gegner laufen'],
  ['Schießen','Gegner in Reichweite anklicken oder Knopf „Schießen“',k('F')],
  ['Fähigkeit','Knopf mit dem Namen der Fähigkeit',k('R')],
  ['Freigeschaltete Fähigkeit','zweiter Fähigkeits-Knopf',k('T')],
  ['Item benutzen','Item im Inventar anklicken',g('<kbd>1</kbd>–<kbd>6</kbd>')],
  ['Item ablegen','✕ neben dem Item',`${k('Shift')} + ${g('<kbd>1</kbd>–<kbd>6</kbd>')}`],
  ['Aufheben','eigenes Feld anklicken',k('G')],
  ['Upgrade wählen','Karte anklicken',g('<kbd>1</kbd>–<kbd>3</kbd>')],
  ['Zug beenden','Knopf „Zug beenden“',k('Leertaste')],
  ['Zielen abbrechen','daneben klicken',k('Esc')],
];

const html=`<table class="controls">
<thead><tr><th scope="col">Aktion</th><th scope="col">Maus / Touch</th><th scope="col">Tastatur</th></tr></thead>
<tbody>${ROWS.map(([a,m,t])=>`<tr><th scope="row">${a}</th><td>${m}</td><td class="kb">${t}</td></tr>`).join('')}</tbody>
</table>`;

for(const el of document.querySelectorAll('[data-controls]'))el.innerHTML=html;
