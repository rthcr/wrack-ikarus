// Steuerungstabelle: eine Quelle, angezeigt auf dem Startbildschirm und im Spiel (aufklappbar).
// Jede Zeile: Aktion, Maus/Touch, Tastatur (HTML mit <kbd>), jeweils Deutsch und Englisch.
// Diagonal: Die Taste links unten heißt auf deutschen Tastaturen Y, auf englischen Z (gleiche Position, Code KeyZ).
import {L} from '../core/i18n.js';
import {on} from '../core/bus.js';
// Tastengruppen bleiben zusammen (span.g), umbrechen darf nur zwischen den Gruppen
const k=(...keys)=>`<span class="g">${keys.map(x=>`<kbd>${x}</kbd>`).join('')}</span>`;
const g=s=>`<span class="g">${s}</span>`;
/* [Deutsch, Englisch] je Spalte */
const ROWS=()=>[
  [['Laufen','Move'],['Feld anklicken oder antippen','click or tap a tile'],[`${k('↑','←','↓','→')} oder ${k('W','A','S','D')}`,`${k('↑','←','↓','→')} or ${k('W','A','S','D')}`]],
  [['Schräg laufen','Move diagonally'],['Feld anklicken','click a tile'],[`${k('Q','E','Y','C')} oder Nummernblock`,`${k('Q','E','Z','C')} or numpad`]],
  [['Nahkampf','Melee'],['angrenzenden Gegner anklicken','click an adjacent enemy'],['in den Gegner laufen','walk into the enemy']],
  [['Schießen','Shoot'],['Gegner in Reichweite anklicken oder Knopf „Schießen“','click an enemy in range or the “Shoot” button'],[k('F'),k('F')]],
  [['Fähigkeit','Ability'],['Knopf mit dem Namen der Fähigkeit','button with the ability’s name'],[k('R'),k('R')]],
  [['Freigeschaltete Fähigkeit','Unlocked ability'],['zweiter Fähigkeits-Knopf','second ability button'],[k('T'),k('T')]],
  [['Item benutzen','Use item'],['Item im Inventar anklicken','click the item in your inventory'],[g('<kbd>1</kbd>–<kbd>6</kbd>'),g('<kbd>1</kbd>–<kbd>6</kbd>')]],
  [['Item ablegen','Drop item'],['✕ neben dem Item','✕ next to the item'],[`${k('Shift')} + ${g('<kbd>1</kbd>–<kbd>6</kbd>')}`,`${k('Shift')} + ${g('<kbd>1</kbd>–<kbd>6</kbd>')}`]],
  [['Aufheben','Pick up'],['eigenes Feld anklicken','click your own tile'],[k('G'),k('G')]],
  [['Upgrade wählen','Choose upgrade'],['Karte anklicken','click a card'],[g('<kbd>1</kbd>–<kbd>3</kbd>'),g('<kbd>1</kbd>–<kbd>3</kbd>')]],
  [['Zug beenden','End turn'],['Knopf „Zug beenden“','“End turn” button'],[k('Leertaste'),k('Space')]],
  [['Zielen abbrechen','Cancel aiming'],['daneben klicken','click elsewhere'],[k('Esc'),k('Esc')]],
];

function render(){
  const t=pair=>L(...pair);
  const html=`<table class="controls">
<thead><tr><th scope="col">${L('Aktion','Action')}</th><th scope="col">${L('Maus / Touch','Mouse / touch')}</th><th scope="col">${L('Tastatur','Keyboard')}</th></tr></thead>
<tbody>${ROWS().map(([a,m,kb])=>`<tr><th scope="row">${t(a)}</th><td>${t(m)}</td><td class="kb">${t(kb)}</td></tr>`).join('')}</tbody>
</table>`;
  for(const el of document.querySelectorAll('[data-controls]'))el.innerHTML=html;
}
render();
on('lang',render);
