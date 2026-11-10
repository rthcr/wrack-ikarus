// Tutorial: führt Schritt für Schritt durch den Übungsraum (core/game.js → startTutorial).
// Die Schritte beobachten nur den Spielzustand; jeder gilt als erledigt, sobald seine Bedingung stimmt.
// Wer schneller ist als die Anleitung, überspringt Schritte einfach.
import {S,startTutorial} from '../core/game.js';
import {RW} from '../core/config.js';
import {L} from '../core/i18n.js';
import {on} from '../core/bus.js';
import {loadTutorialDone,loadScores} from '../core/storage.js';
import {unlock} from '../audio/sfx.js';

const $=id=>document.getElementById(id);
// wie .desk in style.css: Touch-Gerät oder schmaler Bildschirm → Texte ohne Tasten
const touch=()=>!!window.matchMedia&&window.matchMedia('(hover:none),(pointer:coarse),(max-width:860px)').matches;
const seen=G=>G.mons.some(m=>m.hp>0&&S.VIS[m.x+m.y*RW]);
const hurt=G=>G.mons.some(m=>m.hp<m.max);

/* done(G, Start): Start = Zustand beim Beginn des Tutorials */
const STEPS=[
  {t:()=>L('Bewegen','Move'),
   d:()=>touch()?L('Tippe auf ein blau markiertes Feld. Pro Runde kommst du 3 Felder weit.','Tap a tile marked in blue. You can move 3 tiles per round.')
               :L('Klick auf ein blau markiertes Feld oder lauf mit den Pfeiltasten. Pro Runde kommst du 3 Felder weit.','Click a tile marked in blue or walk with the arrow keys. You can move 3 tiles per round.'),
   done:(G,s)=>G.p.x!==s.x||G.p.y!==s.y||G.round>1},
  {t:()=>L('Zug beenden','End your turn'),
   d:()=>L('Jede Runde hast du Bewegung und eine Aktion. Danach sind die Gegner dran: Drück „Zug beenden“'+(touch()?'.':' oder die Leertaste.'),
           'Each round you get movement and one action. Then the enemies move: press “End turn”'+(touch()?'.':' or the space bar.')),
   done:G=>G.round>1||G.phase==='explore'},
  {t:()=>L('Aufheben','Pick up'),
   d:()=>L('Unten links liegt eine Energiezelle. Lauf einfach darüber, dann hebst du sie auf: +4 Munition.','There is an energy cell at the bottom left. Just walk over it to pick it up: +4 ammo.'),
   done:(G,s)=>G.p.ammo>s.ammo||!G.items.some(i=>i.k==='cell'&&i.x===s.cell.x&&i.y===s.cell.y)||hurt(G)||G.phase==='explore'},
  {t:()=>L('Deckung','Cover'),
   d:()=>L('Hinter den Kisten wartet eine Wartungsdrohne. Kisten versperren die Sicht: Sie hat dich noch nicht bemerkt. Geh um die Kisten herum, bis du sie siehst.',
           'A maintenance drone waits behind the crates. Crates block line of sight: it hasn’t noticed you yet. Walk around the crates until you can see it.'),
   done:G=>seen(G)||hurt(G)||G.phase==='explore'},
  {t:()=>L('Schießen','Shoot'),
   d:()=>L('Da ist sie. '+(touch()?'Tippe auf die Drohne oder auf „Schießen“.':'Klick auf die Drohne oder drück F.')+' Ein Schuss kostet deine Aktion und 1 Munition. In der Liste „Gegner in Sicht“ zeigt ein '+(touch()?'Tipp':'Klick')+' auf den Gegner seine Werte.',
           'There it is. '+(touch()?'Tap the drone or “Shoot”.':'Click the drone or press F.')+' A shot costs your action and 1 ammo. In the “Enemies in sight” list, '+(touch()?'tap':'click')+' the enemy to see its stats.'),
   done:(G,s)=>hurt(G)||G.p.ammo<s.ammoMax(G)||G.phase==='explore'},
  {t:()=>L('Erledigen','Finish it'),
   d:()=>L('Schieß weiter oder geh in den Nahkampf: Steht ein Gegner direkt neben dir, '+(touch()?'tippe ihn an':'klick ihn an oder lauf in ihn hinein')+'. Mit „Sperrfeuer“'+(touch()?'':' (R)')+' triffst du alle Gegner neben dir.',
           'Keep shooting or go into melee: when an enemy is right next to you, '+(touch()?'tap it':'click it or walk into it')+'. “Barrage”'+(touch()?'':' (R)')+' hits every enemy next to you.'),
   done:G=>G.phase==='explore'},
  {t:()=>L('Weiter','Move on'),
   d:()=>L('Raum gesichert. Erst jetzt öffnet sich die Tür rechts. Geh hindurch, dann ist das Tutorial geschafft.','Room secured. Only now does the door on the right open. Walk through it to finish the tutorial.'),
   done:()=>false},
];

let step=0,start=null;
function begin(){
  const G=S.G;step=0;
  let top=G.p.ammo;   // höchster Munitionsstand bisher (nach dem Aufheben der Zelle zählt der neue)
  start={x:G.p.x,y:G.p.y,ammo:G.p.ammo,cell:G.items[0]?{x:G.items[0].x,y:G.items[0].y}:{x:-1,y:-1},ammoMax:g=>{top=Math.max(top,g.p.ammo);return top}};
}
function render(){
  const G=S.G,box=$('tutBox'),active=!!(G&&G.tut&&!G.over&&S.screen==='game');
  box.hidden=!active;if(!active)return;
  if(!start)begin();
  while(step<STEPS.length-1&&STEPS[step].done(G,start))step++;
  const s=STEPS[step];
  $('tutStep').textContent=L(`Tutorial · Schritt ${step+1} von ${STEPS.length}`,`Tutorial · step ${step+1} of ${STEPS.length}`);
  $('tutTitle').textContent=s.t();$('tutText').textContent=s.d();
  if(box.dataset.step!==String(step)){box.dataset.step=step;box.classList.remove('pop');void box.offsetWidth;box.classList.add('pop')}
}
on('reset',()=>{start=null});
on('change',render);on('screen',render);on('lang',render);

/* ---------- Startbildschirm ---------- */
function renderTitle(){
  const isNew=!loadTutorialDone()&&!loadScores().length;   // noch nie gespielt: Tutorial hervorheben
  $('tutBtn').textContent=L('Tutorial spielen (2 Minuten)','Play the tutorial (2 minutes)');
  $('tutBtn').classList.toggle('hot',isNew);
  $('tutHint').hidden=!isNew;
  $('tutHint').textContent=L('Neu hier? Das Tutorial zeigt dir in einem Übungsraum Bewegung, Deckung und Kampf.','New here? The tutorial shows you movement, cover and combat in a training room.');
  const m=$('tutMsg');if(m.dataset.kind){m.textContent=m.dataset.kind==='done'?L('Tutorial geschafft. Jetzt wird es ernst: Wähl eine Klasse und starte die Mission.','Tutorial complete. Now it gets serious: pick a class and start the mission.'):''}
}
on('tutorial',kind=>{const m=$('tutMsg');m.dataset.kind=kind;m.hidden=kind!=='done';renderTitle()});
on('screen',s=>{if(s==='title')renderTitle();else if(s==='game'&&!(S.G&&S.G.tut)){$('tutMsg').hidden=true;$('tutMsg').dataset.kind=''}});
on('lang',renderTitle);
$('tutBtn').onclick=()=>{unlock();startTutorial()};
renderTitle();
