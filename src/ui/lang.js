// Sprachumschaltung Deutsch/Englisch für die Oberfläche.
// - Startsprache: ?lang=en|de in der Adresse, sonst gespeicherte Wahl, sonst Browsersprache (Deutsch → de, sonst en).
// - Feste Texte in index.html tragen data-t (Inhalt), data-t-aria (aria-label) bzw. data-t-ph (placeholder).
//   Deutsch steht im HTML selbst, Englisch hier in EN. Alles Übrige zeichnen die Module bei Ereignis "lang" neu.
// Muss in main.js vor hud/screens importiert werden, damit die erste Darstellung schon in der richtigen Sprache ist.
import {setLang,getLang,L} from '../core/i18n.js';
import {loadLang,storeLang} from '../core/storage.js';
import {emit} from '../core/bus.js';

const EN={
  unlock:'Turn on sound',settings:'Settings',
  eyebrow:'Distress call IKARUS-7 · Orbit Kepler-442b · Radio silence for 41 days',
  lede:'The research station has stopped answering. Between you and the last escape pod lie eight rooms full of creatures and rogue machines, and behind them the brood chamber. If you die, you start over.',
  rule1:'<b>Every round: move + 1 action</b>You move up to 3 tiles (Scout: 4) and get one action: melee, shot, item or ability. With “End turn” the enemies move.',
  rule2:'<b>Every room is a fight</b>The door behind you locks. Only when all enemies are dead do 2–3 doors open. What waits behind them, you only see once you enter.',
  rule3:'<b>Cover matters</b>Crates and consoles block line of sight. Enemies only notice you with a clear line of sight; otherwise they search where they last saw you.',
  pickClass:'1 · Choose a class',pickSeed:'2 · Set a seed',roll:'Roll',
  seedHint:'Same seed and same door choices give the same rooms and enemies. Send it to friends and compare your scores.',
  globalLbl:'Leaderboard · all players',localLbl:'Your runs in this browser',
  dock:'3 · Dock',start:'Start mission',
  classic:'Prefer the first version? <a href="/classic/">Play the classic version</a> (German only)',
  hp:'HP',ammo:'Ammo',room:'Room',
  pad:'D-pad',ul:'Up left',u:'Up',ur:'Up right',l:'Left',r:'Right',dl:'Down left',d:'Down',dr:'Down right',
  endTurn:'End turn',endTurn2:'End<br>turn',
  controls:'Controls',seen:'Enemies in sight',equip:'Equipment',
  nameLbl:'Name for the leaderboard of all players',namePh:'max. 16 characters',
  shareLbl:'Challenge for your friends',copy:'Copy',again:'Same seed, try again',back:'Back to start',
  music:'Music',sfx:'Effects',muteMusic:'Mute music',muteSfx:'Mute effects',filter:'Visual filter',filterHint:'Glow and scanlines',close:'Close',
};

/* Deutsche Originale beim ersten Umschalten aus dem HTML merken */
function swap(el,key,get,set,store){
  if(!(store in el.dataset))el.dataset[store]=get();
  const en=EN[key];
  set(getLang()==='en'&&en!=null?en:el.dataset[store]);
}
function applyStatic(){
  document.documentElement.lang=getLang();
  for(const el of document.querySelectorAll('[data-t]'))swap(el,el.dataset.t,()=>el.innerHTML,v=>{el.innerHTML=v},'tDe');
  for(const el of document.querySelectorAll('[data-t-aria]'))swap(el,el.dataset.tAria,()=>el.getAttribute('aria-label')||'',v=>el.setAttribute('aria-label',v),'tAriaDe');
  for(const el of document.querySelectorAll('[data-t-ph]'))swap(el,el.dataset.tPh,()=>el.placeholder,v=>{el.placeholder=v},'tPhDe');
  const b=document.getElementById('langBtn');
  if(b){
    // Der Knopf zeigt die jeweils andere Sprache
    const other=getLang()==='en'?'de':'en';
    b.textContent=other.toUpperCase();b.lang=other;
    const lbl=other==='en'?'Switch to English':'Auf Deutsch umschalten';
    b.setAttribute('aria-label',lbl);b.title=lbl;
  }
}

function initial(){
  let q=null;try{q=new URLSearchParams(location.search).get('lang')}catch(e){}
  if(q==='de'||q==='en')return q;
  const saved=loadLang();if(saved)return saved;
  const nav=(navigator.languages&&navigator.languages[0])||navigator.language||'de';
  return /^de\b/i.test(nav)?'de':'en';
}

function switchTo(l){
  setLang(l);storeLang(getLang());
  // ?lang= aus der Adresse nehmen, sonst gilt nach dem Neuladen wieder die Sprache aus dem Link
  try{const u=new URL(location.href);if(u.searchParams.has('lang')){u.searchParams.delete('lang');history.replaceState(null,'',u.pathname+u.search+u.hash)}}catch(e){}
  applyStatic();emit('lang',getLang());
}

setLang(initial());
applyStatic();
const btn=document.getElementById('langBtn');
if(btn)btn.onclick=()=>{switchTo(getLang()==='en'?'de':'en');btn.blur()};

export {switchTo,applyStatic,L};
