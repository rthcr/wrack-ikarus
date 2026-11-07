// Eingabe über Tastatur, Steuerkreuz und Knöpfe. Klicks aufs Spielfeld verarbeitet die Phaser-Szene.
import {S,startRun,endTurn,stepPlayer,fireButton,ability,ability2,useItem,dropItem,pickupHere,takePerk,cancelTarget,quitRun,setSel,canInput,inCombat} from '../core/game.js';
import {normSeed,randomSeed} from '../core/rng.js';
import {unlock} from '../audio/sfx.js';
import {showScreen,renderClasses,drawPreview,sendScore} from './screens.js';

const $=id=>document.getElementById(id);

const CODEMAP={ArrowUp:[0,-1],ArrowDown:[0,1],ArrowLeft:[-1,0],ArrowRight:[1,0],KeyW:[0,-1],KeyS:[0,1],KeyA:[-1,0],KeyD:[1,0],KeyQ:[-1,-1],KeyE:[1,-1],KeyZ:[-1,1],KeyC:[1,1],
 Numpad8:[0,-1],Numpad2:[0,1],Numpad4:[-1,0],Numpad6:[1,0],Numpad7:[-1,-1],Numpad9:[1,-1],Numpad1:[-1,1],Numpad3:[1,1]};
document.addEventListener('keydown',e=>{
  if(document.querySelector('dialog[open]'))return;   // Einstellungen offen: Spieltasten ruhen
  const screen=S.screen,G=S.G;
  if(e.target&&e.target.tagName==='INPUT'){if(e.key==='Enter'){if(e.target.id==='nameIn'){e.preventDefault();sendScore()}else if(screen==='title'){e.preventDefault();startFromTitle()}}return}
  if(e.ctrlKey||e.metaKey||e.altKey)return;
  if(screen==='title'&&e.key==='Enter'){e.preventDefault();startFromTitle();return}
  if(screen!=='game')return;
  if(G&&G.offer){const m=/^Digit([1-3])$/.exec(e.code);if(m){e.preventDefault();takePerk(+m[1]-1)}return}
  if(e.code==='Escape'){cancelTarget();return}
  if(e.code==='Space'||e.code==='Enter'||e.code==='NumpadEnter'||e.code==='Numpad5'){
    if(e.code!=='Space'&&e.code!=='Numpad5'&&e.target&&e.target.tagName==='BUTTON')return;
    e.preventDefault();if(document.activeElement&&document.activeElement.blur)document.activeElement.blur();
    if(canInput()&&inCombat())endTurn();return}
  const d=CODEMAP[e.code];
  if(d){e.preventDefault();stepPlayer(d[0],d[1]);return}
  if(e.code==='KeyF'){e.preventDefault();fireButton(true);return}
  if(e.code==='KeyR'){e.preventDefault();ability();return}
  if(e.code==='KeyT'){e.preventDefault();ability2();return}
  if(e.code==='KeyG'){e.preventDefault();pickupHere();return}
  const m=/^Digit([1-6])$/.exec(e.code);if(m){e.preventDefault();if(e.shiftKey)dropItem(+m[1]-1);else useItem(+m[1]-1)}
});
document.querySelectorAll('.pad button').forEach(b=>b.addEventListener('click',()=>{const[dx,dy]=b.dataset.d.split(',').map(Number);stepPlayer(dx,dy)}));
$('endBtn').onclick=()=>{if(canInput()&&inCombat())endTurn()};
$('fireBtn').onclick=()=>fireButton(false);$('abBtn').onclick=ability;$('ab2Btn').onclick=ability2;
let quitArmed=null;
$('quitBtn').onclick=()=>{const b=$('quitBtn');
  if(!quitArmed){b.textContent='Wirklich abbrechen?';b.classList.add('warn');quitArmed=setTimeout(()=>{quitArmed=null;b.textContent='Run abbrechen';b.classList.remove('warn')},3000);return}
  clearTimeout(quitArmed);quitArmed=null;quitRun()};
$('rollBtn').onclick=()=>{$('seedIn').value=randomSeed();drawPreview()};
$('seedIn').addEventListener('input',()=>{const v=normSeed($('seedIn').value);if(v!==$('seedIn').value)$('seedIn').value=v;drawPreview()});
function startFromTitle(){unlock();let s=normSeed($('seedIn').value);if(!s){s=randomSeed();$('seedIn').value=s}startRun(s,S.sel)}
$('startBtn').onclick=startFromTitle;
$('sendBtn').onclick=sendScore;
$('againBtn').onclick=()=>{unlock();const e=S.lastEntry;if(e)startRun(e.seed,e.cls)};
$('newBtn').onclick=()=>{const e=S.lastEntry;if(e){$('seedIn').value=e.seed;setSel(e.cls);renderClasses()}showScreen('title')};
$('copyBtn').onclick=()=>{const inp=$('shareTxt'),b=$('copyBtn');
  const fallback=()=>{inp.focus();inp.select();b.textContent='Markiert, jetzt kopieren'};
  try{navigator.clipboard.writeText(inp.value).then(()=>{b.textContent='Kopiert';setTimeout(()=>b.textContent='Kopieren',1600)},fallback)}catch(e){fallback()}};

export {startFromTitle};
