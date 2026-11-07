// Bewegtes Titelbild auf dem Startbildschirm. Läuft nur, solange der Titel sichtbar ist,
// mit etwa 30 Bildern pro Sekunde; bei „Bewegung reduzieren“ steht das Bild still.
import {createTitleScene} from '../render/titleScene.js';
import {on} from '../core/bus.js';
import {S} from '../core/game.js';

const cv=document.getElementById('titleArt');
const ctx=cv.getContext('2d');
const scene=createTitleScene(cv.width,cv.height);
const still=()=>typeof matchMedia==='function'&&matchMedia('(prefers-reduced-motion: reduce)').matches;
let raf=0,lastDraw=-1;

function frame(now){
  raf=0;
  if(S.screen!=='title'||document.hidden)return;
  if(now-lastDraw>=33){lastDraw=now;scene.draw(ctx,now/1000)}
  if(!still())raf=requestAnimationFrame(frame);
}
function start(){if(!raf)raf=requestAnimationFrame(frame)}

scene.draw(ctx,.3);   // sofort ein ruhendes Bild
on('screen',s=>{if(s==='title')start()});
document.addEventListener('visibilitychange',()=>{if(!document.hidden&&S.screen==='title')start()});
start();
