// Pixel-Sprites: werden aus den 16×16-Zeichenketten in art.js auf kleine Canvas gemalt.
// Dieselben Canvas dienen als Phaser-Texturen und als Bildchen in der Oberfläche.
// Jede Figur hat zwei Animationsphasen (Frame 0 und 1), siehe anim in art.js.
import {CLS,IT} from '../core/config.js';
import {ART,PAL,CLASS_PATCH} from './art.js';

export const TS=16; // Kachelgröße in Pixeln

const cache={};
function paint(rows,map){
  const c=document.createElement('canvas');c.width=c.height=TS;const x=c.getContext('2d');
  rows.forEach((row,y)=>{for(let i=0;i<TS;i++){const ch=row[i];if(!ch||ch==='.')continue;x.fillStyle=(map&&map[ch])||PAL[ch]||'#f0f';x.fillRect(i,y,1,1)}});
  return c;
}
/* Zweite Animationsphase aus der ersten ableiten */
function frame1(rows,anim){
  if(anim==='bob')return['................',...rows.slice(0,15)];
  if(anim==='blink')return rows.map(r=>r.replace(/r/g,'R').replace(/y/g,'a'));
  if(anim==='breathe'){
    // Kopf und Oberkörper (obere 11 Zeilen) 1 Pixel tiefer, Beine bleiben stehen
    const top=rows.slice(0,11);return['................',...top.slice(0,10),...rows.slice(11)];
  }
  return rows;
}
function rowsFor(name,cls){
  let rows=ART[name].rows;
  if(name==='player'&&cls){const g=rows.map(r=>[...r]);for(const[x,y,ch]of CLASS_PATCH[cls]||[])g[y][x]=ch;rows=g.map(r=>r.join(''))}
  return rows;
}
/* Canvas für ein Sprite in Phase f (0/1), optional umgefärbt */
function spr(name,map,key,f=0,cls){
  const k=(key||name)+'#'+f;if(cache[k])return cache[k];
  const base=rowsFor(name,cls);
  return cache[k]=paint(f?frame1(base,ART[name].anim):base,map);
}
const itemSpr=k=>{const d=IT[k];return d.spr?spr(d.spr,d.map,'it_'+k):spr(k)};
const monSpr=(t,f=0)=>spr(t,null,t,f);
const playerSpr=(cls,f=0)=>spr('player',CLS[cls].col,'pl_'+cls,f,cls);
const hasAnim=name=>!!ART[name].anim;

const urlCache={};
function iconURL(c,key,size){if(urlCache[key])return urlCache[key];const o=document.createElement('canvas');o.width=o.height=size;const x=o.getContext('2d');x.imageSmoothingEnabled=false;x.drawImage(c,0,0,size,size);try{return urlCache[key]=o.toDataURL()}catch(e){return''}}

/* Textur-Schlüssel, unter denen die Sprites in Phaser registriert werden */
const itemKey=k=>'it_'+k;
const monKey=(t,f=0)=>'m_'+t+'#'+f;
const playerKey=(cls,f=0)=>'pl_'+cls+'#'+f;

export {spr,itemSpr,monSpr,playerSpr,hasAnim,iconURL,itemKey,monKey,playerKey};
