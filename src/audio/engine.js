// Web-Audio-Engine: lädt Sounddateien aus /assets/audio/, spielt Effekte ab und
// blendet Musikspuren weich ineinander. Kennt das Spiel nicht, nur Namen und Lautstärken.
const BASE='/assets/audio/';

let ctx=null,master=null,sfxBus=null,musicBus=null,manifest=null;
const buffers=new Map(),loading=new Map();
const tracks=new Map();   // laufende Musikspuren: name -> {src,gain,target}

export function init(){
  if(ctx)return ctx;
  const AC=window.AudioContext||window.webkitAudioContext;if(!AC)return null;
  try{ctx=new AC()}catch(e){return null}
  master=ctx.createGain();master.connect(ctx.destination);
  sfxBus=ctx.createGain();sfxBus.gain.value=0;sfxBus.connect(master);
  musicBus=ctx.createGain();musicBus.gain.value=0;musicBus.connect(master);
  return ctx;
}
/* Lautstärken 0..1 (Regler); quadratisch, damit der Regler sich gleichmäßig anfühlt */
const BASE_SFX=.9,BASE_MUSIC=.8;
export function setLevels({sfx,music}){
  if(!ctx)return;
  ramp(sfxBus.gain,BASE_SFX*sfx*sfx,.08);ramp(musicBus.gain,BASE_MUSIC*music*music,.25);
}
export const state=()=>ctx?ctx.state:'none';
export function onState(cb){if(ctx)ctx.addEventListener('statechange',()=>cb(ctx.state))}
export const context=()=>ctx;
export const sfxOut=()=>sfxBus;

export function resume(){if(ctx&&ctx.state==='suspended')ctx.resume().catch(()=>{})}
export function suspend(){if(ctx&&ctx.state==='running')ctx.suspend().catch(()=>{})}

/* Weich aus- und einblenden statt hart anhalten (sonst knackt es, wenn das Signal mitten in der Schwingung abreißt).
   Ausblenden: Gesamtlautstärke in sec auf 0, danach anhalten – aber nur, wenn stillSuspend() dann noch true ist. */
let suspendTimer=null;
export function fadeOutAndSuspend(sec=.45,stillSuspend=()=>true){
  if(!ctx)return;clearTimeout(suspendTimer);
  if(ctx.state!=='running')return;
  ramp(master.gain,0,sec);
  suspendTimer=setTimeout(()=>{if(stillSuspend())suspend()},sec*1000+120);
}
export function resumeAndFadeIn(sec=.7){
  if(!ctx)return;clearTimeout(suspendTimer);
  const go=()=>ramp(master.gain,1,sec);
  if(ctx.state==='suspended'){master.gain.cancelScheduledValues(ctx.currentTime);master.gain.setValueAtTime(0,ctx.currentTime);ctx.resume().then(go).catch(()=>{})}
  else go();
}
export const masterLevel=()=>master?master.gain.value:0;

export async function loadManifest(){
  if(manifest)return manifest;
  try{const r=await fetch(BASE+'manifest.json');manifest=r.ok?await r.json():null}catch(e){manifest=null}
  if(!manifest)manifest={sfx:{},music:{}};
  return manifest;
}

/* Datei laden und dekodieren; null, wenn es nicht klappt (dann greift der Ersatzton) */
export function load(name){
  if(!ctx)return Promise.resolve(null);
  if(buffers.has(name))return Promise.resolve(buffers.get(name));
  if(loading.has(name))return loading.get(name);
  const p=fetch(BASE+name+'.mp3')
    .then(r=>{if(!r.ok)throw new Error('HTTP '+r.status);return r.arrayBuffer()})
    .then(data=>new Promise((res,rej)=>ctx.decodeAudioData(data,res,rej)))
    .then(buf=>{buffers.set(name,buf);return buf})
    .catch(()=>{buffers.set(name,null);return null});
  loading.set(name,p);
  return p;
}

/* Effekt abspielen. false, wenn die Datei (noch) nicht da ist. */
export function play(name,{vol=1,rate=1}={}){
  const b=buffers.get(name);if(!ctx||!b)return false;
  const s=ctx.createBufferSource();s.buffer=b;s.playbackRate.value=rate;
  const g=ctx.createGain();g.gain.value=vol;s.connect(g).connect(sfxBus);s.start();
  return true;
}

function ramp(param,to,sec){
  const t=ctx.currentTime;param.cancelScheduledValues(t);param.setValueAtTime(param.value,t);param.linearRampToValueAtTime(to,t+Math.max(.01,sec));
}

/* Musikspur auf Lautstärke vol bringen (0 = ausblenden und danach stoppen). */
export async function music(name,vol,fadeSec=2){
  if(!ctx)return;
  let t=tracks.get(name);
  if(t){t.target=vol;ramp(t.gain.gain,vol,fadeSec);if(vol<=0)stopLater(name,t,fadeSec);return}
  if(vol<=0)return;
  const meta=(await loadManifest()).music[name];const buf=await load(name);
  if(!buf||!meta)return;
  if(tracks.has(name)){music(name,vol,fadeSec);return}   // inzwischen von anderer Stelle gestartet
  const src=ctx.createBufferSource();src.buffer=buf;src.loop=true;
  // Nur den sauberen Mittelteil loopen, siehe scripts/audio/generate.py (PAD)
  src.loopStart=meta.pad;src.loopEnd=meta.pad+meta.loop;
  const gain=ctx.createGain();gain.gain.value=0;src.connect(gain).connect(musicBus);
  src.start(0,meta.pad);
  t={src,gain,target:vol};tracks.set(name,t);ramp(gain.gain,vol,fadeSec);
}
function stopLater(name,t,sec){
  setTimeout(()=>{if(tracks.get(name)===t&&t.target<=0){try{t.src.stop()}catch(e){}tracks.delete(name)}},sec*1000+100);
}
export function stopAllMusic(fadeSec=.6){for(const name of [...tracks.keys()])music(name,0,fadeSec)}
export const playingMusic=()=>[...tracks.entries()].filter(([,t])=>t.target>0).map(([n,t])=>n+':'+t.target);
