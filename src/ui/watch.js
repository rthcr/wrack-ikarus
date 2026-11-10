// Wiederholung ansehen: spielt einen Run aus seiner Aufzeichnung im Browser ab (Bestenliste oder eigener letzter Run).
// Gleiche Regeln wie beim Nachspielen auf dem Server (core/replay.js): Jede Eingabe kommt genau in der Lage,
// in der sie im Original kam; Ereignis R lädt den Stand, der im Original beim Neuladen gespeichert war.
// Hier aber mit echten Wartezeiten und sichtbar. Der Browserspeicher bleibt unberührt (watch in game.js).
import {S,ACTIONS,timing,startRun,restore,runHash,setWatch,abortRun,watchAutoEnd} from '../core/game.js';
import {checkRec} from '../core/replay.js';
import {CLS,ROOMS,VER} from '../core/config.js';
import {L,nf} from '../core/i18n.js';
import {on} from '../core/bus.js';
import {unlock} from '../audio/sfx.js';
import {showScreen} from './screens.js';

const $=id=>document.getElementById(id);
const API=__SITE__+'/api/scores';
const GAP=220;      // Pause zwischen zwei Eingaben in ms (bei 1×)
const AUTO=500;     // automatisches Zugende wie im Spiel: erst, wenn die nächste Eingabe nicht mehr in diese Runde gehört
const STUCK=20000;  // so lange darf die nächste Eingabe höchstens auf sich warten lassen

let W=null;   // {run, w, i, timer, next, since, back, state:'play'|'end'|'bad', entry}

function label(){
  if(!W)return;const r=W.run,cn=CLS[r.cls].n;
  const who=(r.name?r.name+' · ':'')+cn+' · Seed '+r.seed;
  $('watchStep').textContent=W.state==='end'?L('Wiederholung beendet','Replay finished'):W.state==='bad'?L('Wiederholung abgebrochen','Replay stopped'):L('Wiederholung','Replay');
  const e=W.entry;
  $('watchTitle').textContent=W.state==='bad'?L('Diese Aufzeichnung passt nicht mehr zur aktuellen Fassung des Spiels.','This recording no longer matches the current version of the game.')
    :who+(e?' · '+(e.win?L('entkommen','escaped'):L('gefallen in Raum ','fell in room ')+e.room+'/'+ROOMS)+' · '+nf(e.score)+' '+L('Punkte','points'):'');
  $('watchSpeedLbl').textContent=L('Tempo','Speed');
  $('watchStop').textContent=W.state==='play'?L('Beenden','Stop'):L('Zurück','Back');
  for(const b of document.querySelectorAll('#watchBox [data-speed]'))b.setAttribute('aria-pressed',String(+b.dataset.speed===W.speed));
}

function setSpeed(n){if(!W)return;W.speed=n;timing.scale=1/n;label()}

/* run: {seed, cls, lp0, day, rec, name?}. Gibt false zurück, wenn die Aufzeichnung nicht abspielbar ist. */
function startWatch(run){
  if(!run||!CLS[run.cls]||typeof run.seed!=='string'||!/^[A-Z0-9]{1,10}$/.test(run.seed)||!checkRec(run.rec))return false;
  stopWatch(true);
  unlock();
  const back=S.screen==='end'?'end':'title';
  const w={lp:Math.max(0,Math.floor(Number(run.lp0)||0)),saves:[],last:null,feed:false,keep:run.rec.some(ev=>ev[0]==='R')};
  setWatch(w);
  W={run:{...run,name:typeof run.name==='string'?run.name.slice(0,16):''},w,i:0,speed:1,state:'play',entry:null,back,next:performance.now()+700,since:performance.now(),sent:performance.now(),hashed:new Map()};
  timing.scale=1;
  startRun(run.seed,run.cls,{day:run.day||null});
  $('watchBox').hidden=false;$('scrGame').classList.add('watching');$('quitBtn').hidden=true;
  label();
  W.timer=setInterval(tick,30);
  return true;
}

function bad(){W.state='bad';clearInterval(W.timer);abortRun();label()}

function tick(){
  if(!W||W.state!=='play')return;
  const G=S.G,rec=W.run.rec,w=W.w,now=performance.now();
  // Keine Eingabe ist gerade an der Reihe: Bewegung und Aktion verbraucht → Zug endet von selbst, wie im Original
  const idle=()=>{if(now-W.sent>=AUTO*timing.scale)watchAutoEnd()};
  if(W.i>=rec.length){idle();if(now-W.since>STUCK+10000)bad();return}   // der Run endet von selbst (Ereignis watch/end)
  const ev=rec[W.i];
  if(ev[0]==='R'){
    // Neuladen: den Stand suchen, der im Original gespeichert war
    let found=null;
    for(const s of (w.last?[w.last,...w.saves]:w.saves)){if(!W.hashed.has(s))W.hashed.set(s,runHash(JSON.parse(s).G));if(W.hashed.get(s)===ev[1]){found=s;break}}
    if(found){w.lp=ev[2];if(!restore(JSON.parse(found))){bad();return}W.i++;W.since=now}
    else{idle();if(now-W.since>STUCK)bad()}
    return;
  }
  const ready=G&&!G.over&&!S.busy&&G.rounds===ev[1]&&(G.phase==='explore'?'x':'p')===ev[2];
  if(ready&&now>=W.next){
    w.last=w.saves.length?w.saves[w.saves.length-1]:w.last;w.saves=[];W.hashed.clear();
    w.feed=true;try{ACTIONS[ev[0]](...ev.slice(3))}finally{w.feed=false}
    W.i++;W.since=W.sent=now;
    // Schritte dicht hintereinander, alles andere mit kurzer Pause zum Mitlesen
    W.next=now+(ev[0]==='s'?110:GAP)*timing.scale;
  }else if(!ready){idle();if(now-W.since>STUCK)bad()}
}

/* Wiederholung beenden und dorthin zurück, wo sie gestartet wurde. quiet: ohne Bildschirmwechsel (neue Wiederholung folgt) */
function stopWatch(quiet){
  if(!W)return;
  clearInterval(W.timer);const back=W.back;W=null;
  abortRun();setWatch(null);timing.scale=1;
  $('watchBox').hidden=true;$('scrGame').classList.remove('watching');
  if(!quiet)showScreen(back);
}

on('watch',(kind,entry)=>{if(W&&kind==='end'){W.state='end';W.entry=entry;clearInterval(W.timer);label()}});
on('lang',label);
$('watchStop').onclick=()=>stopWatch();
for(const b of document.querySelectorAll('#watchBox [data-speed]'))b.onclick=()=>setSpeed(+b.dataset.speed);
document.addEventListener('keydown',e=>{if(W&&e.code==='Escape'&&!document.querySelector('dialog[open]'))stopWatch()});

/* Knöpfe ▶ in den Bestenlisten: Aufzeichnung vom Server holen und abspielen */
document.addEventListener('click',async ev=>{
  const b=ev.target&&ev.target.closest&&ev.target.closest('[data-replay]');if(!b||b.disabled)return;
  const fail=()=>{b.textContent='✕';b.title=L('Aufzeichnung nicht verfügbar','Recording not available');b.setAttribute('aria-label',b.title)};
  b.disabled=true;b.textContent='…';
  try{
    const r=await fetch(API+'?replay='+encodeURIComponent(b.dataset.replay)+(b.dataset.day?'&day='+encodeURIComponent(b.dataset.day):''),{headers:{accept:'application/json'},cache:'no-store'});
    const j=r.ok?await r.json():null;
    if(!j||j.v!==VER||!startWatch(j)){fail();return}
    b.disabled=false;b.textContent='▶';
  }catch(e){fail()}
});
/* Eigener letzter Run (Endbildschirm) */
$('watchBtn').onclick=()=>{const e=S.lastEntry;if(e&&e.rec&&!e.quit)startWatch({seed:e.seed,cls:e.cls,lp0:e.lp0,day:e.day,rec:e.rec.map(x=>x.slice()),name:''})};

export {startWatch,stopWatch};
