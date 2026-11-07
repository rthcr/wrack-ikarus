// Ton und Musik im Spiel.
// Effekte: Dateien aus /assets/audio/ (erzeugt mit scripts/audio/generate.py). Solange eine Datei
// fehlt oder noch lädt, spielt der alte im Browser erzeugte Retro-Ton als Ersatz.
// Musik: Ambient-Spur je Deck; die Kampfspur mischt sich dazu, sobald Gegner dich entdeckt haben.
import {on} from '../core/bus.js';
import {tierOf} from '../core/config.js';
import {S} from '../core/game.js';
import {loadSound,storeSound,loadMusic,storeMusic} from '../core/storage.js';
import * as E from './engine.js';

let soundOn=loadSound(),musicOn=loadMusic(),started=false;

/* Lautstärken der Effekte untereinander */
const VOL={shoot:.5,hit:.8,miss:.45,hurt:.85,zap:.45,spit:.65,pick:.5,kill:.7,drop:.45,lvl:.55,lift:.55,die:.9,emp:.65,boom:.9,win:.8};

/* ---------- Ersatztöne (die Klänge der klassischen Fassung) ---------- */
function beep(f,dur,type,vol,slide){const AC=E.context();if(!AC)return;try{const t=AC.currentTime,o=AC.createOscillator(),g=AC.createGain();o.type=type||'square';o.frequency.setValueAtTime(f,t);if(slide)o.frequency.exponentialRampToValueAtTime(Math.max(30,f+slide),t+dur);g.gain.setValueAtTime(vol||.05,t);g.gain.exponentialRampToValueAtTime(.0001,t+dur);o.connect(g).connect(E.sfxOut());o.start(t);o.stop(t+dur+.02)}catch(e){}}
function noise(dur,vol){const AC=E.context();if(!AC)return;try{const n=AC.sampleRate*dur,b=AC.createBuffer(1,n,AC.sampleRate),d=b.getChannelData(0);for(let i=0;i<n;i++)d[i]=(Math.random()*2-1)*(1-i/n);const s=AC.createBufferSource(),g=AC.createGain();s.buffer=b;g.gain.value=vol;s.connect(g).connect(E.sfxOut());s.start()}catch(e){}}
const SYNTH={
 hit:()=>beep(220,.08,'square',.05,-120),miss:()=>beep(140,.05,'triangle',.03),
 hurt:()=>beep(130,.16,'sawtooth',.06,-70),shoot:()=>beep(1100,.12,'square',.035,-850),
 zap:()=>beep(700,.1,'sawtooth',.03,-400),spit:()=>{noise(.18,.08);beep(260,.15,'triangle',.04,-120)},
 pick:()=>{beep(660,.06,'square',.04);setTimeout(()=>beep(990,.08,'square',.04),60)},
 kill:()=>beep(320,.22,'triangle',.07,-260),drop:()=>beep(440,.07,'square',.035,-200),
 lvl:()=>[523,659,784,1046].forEach((f,i)=>setTimeout(()=>beep(f,.1,'square',.04),i*80)),
 lift:()=>beep(420,.5,'sine',.06,-320),die:()=>{beep(300,1.1,'sawtooth',.07,-260);noise(.5,.05)},
 emp:()=>beep(90,.45,'sawtooth',.06,700),boom:()=>{noise(.45,.14);beep(90,.35,'sawtooth',.06,-50)},
 win:()=>[392,523,659,784,1046,1318].forEach((f,i)=>setTimeout(()=>beep(f,.16,'square',.045),i*110))
};

/* Effekt abspielen, mit leichter Tonhöhen-Streuung, damit Wiederholungen nicht mechanisch klingen */
function play(name){
  if(!soundOn||!E.context())return;
  if(E.play(name,{vol:VOL[name]??.7,rate:1+(Math.random()-.5)*.06}))return;
  if(SYNTH[name])SYNTH[name]();
}

/* ---------- Musik je nach Lage ---------- */
const AMB=['amb_fracht','amb_wohn','amb_reaktor','amb_brut'];
const ALL_MUSIC=[...AMB,'kampf','kampf_boss'];
let last='';
function target(){
  const G=S.G,scr=S.screen;
  if(scr==='title')return{amb_fracht:.55};
  if(scr==='end'){const e=S.lastEntry;return e&&e.win?{amb_fracht:.5}:{}}
  if(scr!=='game'||!G||!G.alive)return{};
  const amb=AMB[tierOf(G.room)-1];
  const fight=G.phase!=='explore'&&G.mons.some(m=>m.hp>0);
  const spotted=fight&&G.mons.some(m=>m.hp>0&&m.aware);
  const t={[amb]:fight?.7:.9};
  if(spotted)t[G.boss?'kampf_boss':'kampf']=G.boss?.95:.75;
  return t;
}
function updateMusic(){
  if(!started)return;
  const t=musicOn?target():{};
  const key=JSON.stringify(t);if(key===last)return;last=key;
  for(const name of ALL_MUSIC){const v=t[name]||0;E.music(name,v,v>0?2.2:(S.G&&!S.G.alive?1.2:2.8))}
}

/* Browser erlauben Ton erst nach einer Nutzeraktion: dann Engine starten und Effekte vorladen. */
function unlock(){
  if(!E.init())return;
  E.resume();
  if(started)return;started=true;
  E.loadManifest().then(m=>{Object.keys(m.sfx).forEach(n=>E.load(n));updateMusic()});
}
function setSound(v){soundOn=v;storeSound(v);if(v)unlock()}
function setMusic(v){musicOn=v;storeMusic(v);unlock();last='';updateMusic()}
const isSoundOn=()=>soundOn;
const isMusicOn=()=>musicOn;

on('sfx',play);
on('change',updateMusic);
on('screen',()=>{last='';updateMusic()});

// Erste Berührung oder Taste irgendwo auf der Seite schaltet den Ton frei
const first=()=>{unlock();updateMusic()};
document.addEventListener('pointerdown',first,{once:true,capture:true});
document.addEventListener('keydown',first,{once:true,capture:true});
// Im Hintergrund-Tab schweigen
document.addEventListener('visibilitychange',()=>{if(document.hidden)E.suspend();else if(started)E.resume()});

// Für Tests
window.__wrackAudio={playing:E.playingMusic,target};

export {unlock,play,setSound,isSoundOn,setMusic,isMusicOn};
