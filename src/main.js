// Einstieg: Oberfläche, Ton, Eingabe und Phaser zusammenstecken, dann gespeicherten Run fortsetzen.
import Phaser from 'phaser';
import './style.css';
// Sprache zuerst festlegen, damit alle folgenden Module gleich richtig beschriften
import './ui/lang.js';
import {L} from './core/i18n.js';
import {RW,RH} from './core/config.js';
import {TS} from './render/sprites.js';
import {normSeed,randomSeed} from './core/rng.js';
import {loadRun,storeRun,loadFilter,storeFilter} from './core/storage.js';
import * as actions from './core/game.js';
import {S,restore,setSel} from './core/game.js';
import {on,emit} from './core/bus.js';
import {GameScene} from './render/GameScene.js';
import './audio/sfx.js';
import './ui/hud.js';
import {showScreen,renderClasses} from './ui/screens.js';
import './ui/input.js';
import './ui/settings.js';
import './ui/titleArt.js';
import './ui/controls.js';
import './ui/fullscreen.js';

const $=id=>document.getElementById(id);

const game=new Phaser.Game({
  type:Phaser.AUTO,
  parent:'stage',
  width:RW*TS,height:RH*TS,
  pixelArt:true,
  backgroundColor:'#000000',
  banner:false,
  input:{keyboard:false},       // Tastatur verarbeitet ui/input.js für die ganze Seite
  audio:{noAudio:true},          // Ton kommt vorerst aus audio/sfx.js
  scale:{mode:Phaser.Scale.NONE,zoom:2},
  scene:[GameScene],
  callbacks:{postBoot:g=>{g.canvas.id='cv';g.canvas.setAttribute('aria-label',L('Spielfeld','Game board'));fit(true)}},
});

/* Sichthöhe ohne die beim Scrollen ein- und ausfahrenden Browserleisten (iPad, iPhone):
   100svh bleibt gleich, innerHeight nicht. Ältere Browser ohne svh liefern 0, dann gilt innerHeight. */
const vhProbe=document.createElement('div');
vhProbe.style.cssText='position:fixed;top:0;left:0;width:0;height:100svh;visibility:hidden;pointer-events:none';
document.body.appendChild(vhProbe);
const viewH=()=>vhProbe.offsetHeight||window.innerHeight;

/* Spielfeld so groß wie möglich; ab Faktor 3 ganzzahlig, darunter in Viertel- bzw. Halbschritten.
   Ohne force bleibt die Größe, solange sich nur die Höhe um weniger als 120 px ändert (Leisten beim Scrollen). */
let fitW=0,fitH=0;
function fit(force){
  const st=$('stage');const w=st.clientWidth-2;if(w<=0||!game.scale)return;
  const h=viewH();
  if(!force&&w===fitW&&Math.abs(h-fitH)<120)return;
  fitW=w;fitH=h;
  const maxH=Math.max(220,h*.58);
  let s=Math.min(w/(RW*TS),maxH/(RH*TS));s=s>=3?Math.floor(s):s>=2?Math.floor(s*2)/2:Math.max(.75,Math.floor(s*4)/4);
  if(game.scale.zoom!==s)game.scale.setZoom(s);
}
on('screen',s=>{if(s==='game')requestAnimationFrame(()=>fit(true))});
// Neuer Run: Seed in die Adresszeile, damit man den Link teilen kann
on('reset',()=>{try{history.replaceState(null,'','#seed-'+S.G.seed)}catch(e){}});
window.addEventListener('resize',()=>{if(S.screen==='game')fit()});
// Vollbild an/aus: Platz neu verteilen
for(const ev of ['fullscreenchange','webkitfullscreenchange'])document.addEventListener(ev,()=>{if(S.screen==='game')requestAnimationFrame(()=>fit(true))});

/* Bildfilter (Leuchten, Röhrenmonitor) an/aus */
let filterOn=loadFilter();
game.registry.set('filter',filterOn);
function applyFilter(){
  $('stage').classList.toggle('crt',filterOn);
  $('fxBtn').textContent=filterOn?L('an','on'):L('aus','off');$('fxBtn').setAttribute('aria-pressed',filterOn);$('fxBtn').classList.toggle('on',filterOn);
  game.registry.set('filter',filterOn);emit('filter',filterOn);
}
$('fxBtn').onclick=()=>{filterOn=!filterOn;storeFilter(filterOn);applyFilter()};
applyFilter();
on('lang',()=>{applyFilter();if(game.canvas)game.canvas.setAttribute('aria-label',L('Spielfeld','Game board'))});

function boot(){
  const saved=loadRun();
  let hs='';try{hs=location.hash||''}catch(e){}
  const m=/^#seed-([A-Za-z0-9]{1,10})$/.exec(hs);
  $('seedIn').value=m?normSeed(m[1]):randomSeed();
  if(saved&&saved.sel)setSel(saved.sel);
  renderClasses();
  // Ein beschädigter Spielstand darf den Start nicht verhindern: dann verwerfen und zum Titel
  let ok=false;try{ok=restore(saved)}catch(e){console.warn('Gespeicherter Run verworfen:',e);ok=false}
  if(!ok){storeRun(null);showScreen('title')}
}
boot();

// Für Tests in der Browser-Konsole bzw. Playwright
window.__wrack={S,game,actions};
