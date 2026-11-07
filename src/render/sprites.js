// Pixel-Sprites: werden aus den Zeichenketten in config.js auf kleine Canvas gemalt.
// Dieselben Canvas dienen als Phaser-Texturen und als Bildchen in der Oberfläche.
import {PAL,SPR,CLS,IT} from '../core/config.js';

const sprCache={};
function spr(name,map,key){
  key=key||name;if(sprCache[key])return sprCache[key];
  const c=document.createElement('canvas');c.width=c.height=8;const x=c.getContext('2d');
  SPR[name].forEach((row,y)=>{for(let i=0;i<8;i++){const ch=row[i];if(!ch||ch==='.')continue;x.fillStyle=(map&&map[ch])||PAL[ch]||'#f0f';x.fillRect(i,y,1,1)}});
  return sprCache[key]=c;
}
const itemSpr=k=>{const d=IT[k];return d.spr?spr(d.spr,d.map,'it_'+k):spr(k)};
const monSpr=t=>spr(t);
const playerSpr=cls=>spr('player',CLS[cls].col,'pl_'+cls);
const urlCache={};
function iconURL(c,key,size){if(urlCache[key])return urlCache[key];const o=document.createElement('canvas');o.width=o.height=size;const x=o.getContext('2d');x.imageSmoothingEnabled=false;x.drawImage(c,0,0,size,size);try{return urlCache[key]=o.toDataURL()}catch(e){return''}}
/* Textur-Schlüssel, unter denen die Sprites in Phaser registriert werden */
const itemKey=k=>IT[k].spr?'it_'+k:k;
const monKey=t=>t;
const playerKey=cls=>'pl_'+cls;

export {spr,itemSpr,monSpr,playerSpr,iconURL,itemKey,monKey,playerKey};
