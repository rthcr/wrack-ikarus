// Einstieg: Oberfläche, Ton, Eingabe und Phaser zusammenstecken, dann gespeicherten Run fortsetzen.
import Phaser from 'phaser';
import './style.css';
import {RW,RH} from './core/config.js';
import {TS} from './render/sprites.js';
import {normSeed,randomSeed} from './core/rng.js';
import {loadRun,loadFilter,storeFilter} from './core/storage.js';
import * as actions from './core/game.js';
import {S,restore,setSel} from './core/game.js';
import {on,emit} from './core/bus.js';
import {GameScene} from './render/GameScene.js';
import './audio/sfx.js';
import './ui/hud.js';
import {showScreen,renderClasses} from './ui/screens.js';
import './ui/input.js';
import './ui/settings.js';

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
  callbacks:{postBoot:g=>{g.canvas.id='cv';g.canvas.setAttribute('aria-label','Spielfeld');fit()}},
});

/* Spielfeld so groß wie möglich; ab Faktor 3 ganzzahlig, darunter in Viertel- bzw. Halbschritten */
function fit(){
  const st=$('stage');const w=st.clientWidth-2;if(w<=0||!game.scale)return;
  const maxH=Math.max(220,window.innerHeight*.58);
  let s=Math.min(w/(RW*TS),maxH/(RH*TS));s=s>=3?Math.floor(s):s>=2?Math.floor(s*2)/2:Math.max(.75,Math.floor(s*4)/4);
  if(game.scale.zoom!==s)game.scale.setZoom(s);
}
on('screen',s=>{if(s==='game')requestAnimationFrame(fit)});
window.addEventListener('resize',()=>{if(S.screen==='game')fit()});

/* Bildfilter (Leuchten, Röhrenmonitor) an/aus */
let filterOn=loadFilter();
game.registry.set('filter',filterOn);
function applyFilter(){
  $('stage').classList.toggle('crt',filterOn);
  $('fxBtn').textContent=filterOn?'an':'aus';$('fxBtn').setAttribute('aria-pressed',filterOn);$('fxBtn').classList.toggle('on',filterOn);
  game.registry.set('filter',filterOn);emit('filter',filterOn);
}
$('fxBtn').onclick=()=>{filterOn=!filterOn;storeFilter(filterOn);applyFilter()};
applyFilter();

function boot(){
  const saved=loadRun();
  let hs='';try{hs=location.hash||''}catch(e){}
  const m=/^#seed-([A-Za-z0-9]{3,10})$/.exec(hs);
  $('seedIn').value=m?normSeed(m[1]):randomSeed();
  if(saved&&saved.sel)setSel(saved.sel);
  renderClasses();
  if(!restore(saved))showScreen('title');
}
boot();

// Für Tests in der Browser-Konsole bzw. Playwright
window.__wrack={S,game,actions};
