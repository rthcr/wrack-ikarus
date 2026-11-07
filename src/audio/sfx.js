// Soundeffekte: vorerst wie bisher im Browser erzeugte Retro-Töne (Web Audio).
// Später werden sie hier durch Sounddateien ersetzt; der Rest des Spiels ruft nur play(name).
import {on} from '../core/bus.js';
import {loadSound,storeSound} from '../core/storage.js';

let AC=null,soundOn=loadSound();
function audio(){if(AC)return;try{AC=new(window.AudioContext||window.webkitAudioContext)()}catch(e){AC=null}}
function beep(f,dur,type,vol,slide){if(!soundOn||!AC)return;try{const t=AC.currentTime,o=AC.createOscillator(),g=AC.createGain();o.type=type||'square';o.frequency.setValueAtTime(f,t);if(slide)o.frequency.exponentialRampToValueAtTime(Math.max(30,f+slide),t+dur);g.gain.setValueAtTime(vol||.05,t);g.gain.exponentialRampToValueAtTime(.0001,t+dur);o.connect(g).connect(AC.destination);o.start(t);o.stop(t+dur+.02)}catch(e){}}
function noise(dur,vol){if(!soundOn||!AC)return;try{const n=AC.sampleRate*dur,b=AC.createBuffer(1,n,AC.sampleRate),d=b.getChannelData(0);for(let i=0;i<n;i++)d[i]=(Math.random()*2-1)*(1-i/n);const s=AC.createBufferSource(),g=AC.createGain();s.buffer=b;g.gain.value=vol;s.connect(g).connect(AC.destination);s.start()}catch(e){}}
const SFX={
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
/* Browser erlauben Ton erst nach einer Nutzeraktion. */
function unlock(){audio();if(AC&&AC.state==='suspended')AC.resume().catch(()=>{})}
function play(name){if(SFX[name])SFX[name]()}
function setSound(on){soundOn=on;storeSound(on);if(on)unlock()}
const isSoundOn=()=>soundOn;

on('sfx',play);

export {unlock,play,setSound,isSoundOn};
