// Kacheln in 16×16, direkt auf den Raum-Canvas gemalt (jedes Bild neu, damit Lampen
// blinken und Bildschirme laufen). Außerdem: welche Kacheln Licht abgeben.
import {RW,RH,WALL,FLOOR,BLOCK,DOOR,EXIT,POD,tierOf} from '../core/config.js';
import {TS} from './sprites.js';
import {sideTile} from '../core/roomgen.js';

/* Farben der Raum-Ereignisse, gleich wie in ui/hud.js */
const EVCOL={dark:'#b779e8',coolant:'#5fd3e6',cache:'#8bdc5f',alarm:'#ff4d3d'};

/* Bodenfarben je Deck: Grundton, Fuge, Kante, Niete */
const FLOORS=[
  {base:'#222b36',seam:'#151b23',hi:'#2d3846',rivet:'#3b4859'}, // Frachtdeck
  {base:'#1f2b28',seam:'#131b19',hi:'#293934',rivet:'#364a42'}, // Wohnbereich
  {base:'#2c2420',seam:'#1b1613',hi:'#392f29',rivet:'#4b3c33'}, // Reaktorring
  {base:'#251d2c',seam:'#17111d',hi:'#2f2539',rivet:'#3d304a'}, // Brutkammer
];

const lampOn=(deco,now)=>((((now/600)+deco*13)|0)%2)===1;
const isFace=(G,i)=>{const below=i+RW<RW*RH?G.map[i+RW]:WALL;return below===FLOOR||below===BLOCK};

function floor(ctx,x,y,f,deco,tier,now){
  const r=(c,a,b,w,h)=>{ctx.fillStyle=c;ctx.fillRect(x+a,y+b,w,h)};
  r(f.base,0,0,16,16);
  r(f.hi,0,0,16,1);r(f.hi,0,0,1,16);
  r(f.seam,0,15,16,1);r(f.seam,15,0,1,16);
  for(const[a,b]of[[2,2],[13,2],[2,13],[13,13]])r(f.rivet,a,b,1,1);
  if(deco>.88){ // Gitter
    r(f.seam,3,3,10,10);for(let k=4;k<13;k+=2)r('#0a0e13',4,k,8,1);
  }else if(deco<.08){ // Kratzer
    r(f.hi,4,9,1,1);r(f.hi,5,8,1,1);r(f.hi,6,7,1,1);r(f.hi,9,11,2,1);
  }else if(deco<.16){ // Plattenfuge
    r(f.seam,1,8,14,1);r(f.hi,1,9,14,1);
  }
  if(tier===3&&deco>.3&&deco<.37){for(let k=0;k<16;k+=4){r('#ffb000',k,13,2,2);r('#14181e',k+2,13,2,2)}}
  if(tier===4&&deco>.78&&deco<.88){ // Schleim
    ctx.fillStyle='rgba(139,220,95,.18)';ctx.fillRect(x+4,y+6,7,4);ctx.fillRect(x+5,y+5,5,6);
    ctx.fillStyle='rgba(200,255,170,.25)';ctx.fillRect(x+6,y+6,1,1);
  }
}

export function drawTile(ctx,G,t,i,x,y,now){
  const deco=G.deco[i],tier=tierOf(G.room),f=FLOORS[tier-1];
  const r=(c,a,b,w,h)=>{ctx.fillStyle=c;ctx.fillRect(x+a,y+b,w,h)};

  if(t===WALL){
    if(isFace(G,i)){
      r('#2f3a47',0,0,16,6);r('#45525f',0,0,16,1);r('#56616e',0,5,16,1);
      r('#1c232c',0,6,16,10);r('#141a21',0,6,1,10);r('#141a21',8,6,1,10);r('#252e39',1,7,15,1);r('#0e1217',0,15,16,1);
      if(deco<.12){ // Wandlampe
        r('#3e4a58',4,8,8,4);
        const on=lampOn(deco,now);r(on?'#5fd3e6':'#227f92',5,9,6,2);if(on)r('#d6f7fc',7,9,2,1);
      }else if(deco<.2){ // Lüftung
        for(const k of[9,11,13])r('#0a0e13',3,k,10,1);
      }else if(deco>.5&&deco<.57){ // Leitung
        r('#3e4a58',11,6,3,10);r('#7a8794',12,6,1,10);r('#ffb000',11,10,3,1);
      }else if(deco>.93){ // Warnschild
        r('#ffb000',6,8,5,4);r('#14181e',8,9,1,2);
      }
    }else{
      r('#262f3a',0,0,16,16);r('#323d4a',0,0,16,1);r('#323d4a',0,0,1,16);r('#1a2129',0,15,16,1);r('#1a2129',15,0,1,16);
      r('#2a3440',3,3,10,10);r('#3e4a58',2,2,1,1);r('#3e4a58',13,2,1,1);r('#3e4a58',2,13,1,1);r('#3e4a58',13,13,1,1);
    }
    return;
  }

  floor(ctx,x,y,f,t===FLOOR?deco:.5,tier,now);
  if(t===FLOOR)return;

  if(t===BLOCK){
    if(G.boss){ // Harzkokon der Brutkammer
      r('#1a0f26',2,15,12,1);
      r('#3a1f57',3,3,10,12);r('#3a1f57',2,5,12,8);r('#5b2e86',4,4,8,10);r('#5b2e86',3,6,10,6);
      r('#b779e8',5,5,1,2);r('#b779e8',4,7,1,1);
      const pulse=.55+.45*Math.sin(now/300+deco*9);
      ctx.fillStyle=`rgba(139,220,95,${pulse})`;ctx.fillRect(x+7,y+7,3,4);ctx.fillStyle=`rgba(220,255,200,${pulse})`;ctx.fillRect(x+8,y+8,1,1);
      return;
    }
    if(deco<.45){ // Frachtkiste
      r('#0b0e13',1,2,14,14);r('#6b5a3a',2,3,12,12);r('#8a7449',2,3,12,2);r('#4a3e28',2,8,12,1);r('#4a3e28',2,12,12,1);
      r('#4a3e28',4,5,1,9);r('#4a3e28',11,5,1,9);r('#a08a5a',2,3,12,1);r('#ffb000',6,10,4,1);r('#0b0e13',2,15,12,1);
    }else if(deco<.75){ // Konsole mit Bildschirm
      r('#0b0e13',1,3,14,13);r('#3a4553',2,4,12,11);r('#56616e',2,4,12,1);
      r('#0f1a22',3,5,10,6);
      const scan=((now/140+deco*20)|0)%6;
      for(let k=0;k<6;k++)if(k!==scan)r('#174552',4+((k*3+((deco*10)|0))%5),5+k,3+(k%3),1);
      r('#5fd3e6',3,5+scan,10,1);
      r(((now/400+deco*7)|0)%2?'#ff4d3d':'#8f1f1a',4,13,1,1);r('#8bdc5f',6,13,1,1);r('#ffb000',8,13,1,1);r('#2c343e',10,12,3,2);
    }else{ // Tank
      r('#0b0e13',2,0,12,16);r('#4a5563',3,1,10,15);r('#56616e',3,0,10,2);r('#7a8794',5,2,1,13);r('#9aa6b2',5,4,1,3);
      r('#343d48',11,2,2,13);r('#ffb000',3,7,10,2);r('#9a5d06',3,8,10,1);r('#2c343e',3,14,10,2);
    }
    return;
  }

  if(t===DOOR){ // verriegelt
    r('#3e4a58',0,0,16,16);r('#56616e',0,0,16,1);r('#0b0e13',1,1,14,14);
    for(let py=2;py<14;py++)for(let px=2;px<14;px++)r((((px+py)>>2)&1)?'#ffb000':'#14181e',px,py,1,1);
    r('#2c343e',6,6,4,4);r(((now/500)|0)%2?'#ff4d3d':'#8f1f1a',7,7,2,2);
    return;
  }
  if(t===EXIT){ // offen
    const ex=G.exits.find(e=>{const s=sideTile(e.side,e.pos);return s.x===(i%RW)&&s.y===((i/RW)|0)}),hint=ex&&ex.hint;
    const pulse=.5+.5*Math.sin(now/260);
    r('#3e4a58',0,0,16,16);r('#05070a',2,2,12,12);
    ctx.fillStyle=`rgba(255,176,0,${.45+.55*pulse})`;
    ctx.fillRect(x+1,y+1,14,1);ctx.fillRect(x+1,y+14,14,1);ctx.fillRect(x+1,y+1,1,14);ctx.fillRect(x+14,y+1,1,14);
    ctx.fillStyle=`rgba(255,176,0,${.3+.7*pulse})`;for(let k=0;k<3;k++){ctx.fillRect(x+6+k,y+5+k,1,1);ctx.fillRect(x+6+k,y+10-k,1,1)}
    // Anzeige: oben das Raum-Ereignis (Farbe wie in der Statuskonsole), unten ein Strich je Gegner (rot = Elite dabei)
    if(hint){
      r('#05070a',2,2,12,3);r('#05070a',2,11,12,3);
      if(hint.event)r(EVCOL[hint.event],5,2,6,2);
      const n=hint.boss?6:Math.min(6,hint.n);for(let k=0;k<n;k++)r(hint.boss?'#b779e8':hint.elite?'#ff4d3d':'#eef3f6',3+k*2,12,1,2);
    }
    return;
  }
  if(t===POD){
    r('#0b0e13',2,0,12,16);r('#d7dde3',3,1,10,14);r('#eef3f6',4,1,4,1);r('#9aa6b2',11,2,2,12);
    r('#227f92',5,3,6,6);r('#5fd3e6',5,3,6,4);r('#d6f7fc',6,4,2,1);r('#9aa6b2',3,11,10,1);
    const open=G.bossDead&&G.phase==='explore';
    r(open?((now/300|0)%2?'#8bdc5f':'#3f8a2c'):'#ff4d3d',7,12,2,2);
  }
}

/* Lichtquellen der Umgebung: {x,y,r,col,i} in Pixeln, i = Stärke 0..1 */
export function envLights(G,now){
  const out=[];const tier=tierOf(G.room);
  for(let i=0;i<RW*RH;i++){
    const t=G.map[i],x=(i%RW)*TS,y=((i/RW)|0)*TS,deco=G.deco[i];
    if(t===WALL&&deco<.12&&isFace(G,i)&&lampOn(deco,now))out.push({x:x+8,y:y+13,r:44,col:0x5fd3e6,i:.75});
    else if(t===BLOCK&&!G.boss&&deco>=.45&&deco<.75)out.push({x:x+8,y:y+8,r:30,col:0x5fd3e6,i:.5+.1*Math.sin(now/200+deco*30)});
    else if(t===BLOCK&&G.boss)out.push({x:x+8,y:y+9,r:30,col:0x8bdc5f,i:.4+.25*Math.sin(now/300+deco*9)});
    else if(t===EXIT)out.push({x:x+8,y:y+8,r:52,col:0xffb000,i:.6+.3*Math.sin(now/260)});
    else if(t===DOOR)out.push({x:x+8,y:y+8,r:20,col:0xff4d3d,i:.35});
    else if(t===POD)out.push({x:x+8,y:y+8,r:40,col:G.bossDead&&G.phase==='explore'?0x8bdc5f:0xff4d3d,i:.6});
    else if(t===FLOOR&&tier===3&&deco>.3&&deco<.37)out.push({x:x+8,y:y+14,r:18,col:0xffb000,i:.25});
  }
  return out;
}
