// Phaser-Szene: zeichnet den Raum, Figuren, Markierungen und Effekte.
// Sie liest den Zustand aus game.js und verändert ihn nie selbst, außer über die
// gleichen Aktionen, die auch Tastatur und Knöpfe benutzen (tileClick, setHover).
//
// Ebenen (depth):
//   0  Raum (Canvas-Textur, jedes Bild neu gemalt: Kacheln, Blinklichter, Nebel)
//   1  Unter-Markierungen (Reichweite, Weg, Leuchten unter Boss und Elite)
//   2  Items   3  Geister (zuletzt gesehene Gegner)   4  Gegner   5  Spielerin
//   6  Ober-Markierungen (Rahmen, Lebensbalken, Zielbereiche, Schüsse)
//   7  Partikel
import Phaser from 'phaser';
import {RW,RH,T,MON,WALL,FLOOR,BLOCK,DOOR,EXIT,POD,FLOORTINT,tierOf} from '../core/config.js';
import {cheb,line} from '../core/geometry.js';
import {S,canInput,canShoot,shootable,nadeOk,pathTo,itemAt,tileClick,setHover} from '../core/game.js';
import {on} from '../core/bus.js';
import {itemSpr,monSpr,playerSpr,itemKey,monKey,playerKey} from './sprites.js';

const hex=c=>parseInt(c.slice(1),16);
const reduced=()=>typeof matchMedia==='function'&&matchMedia('(prefers-reduced-motion: reduce)').matches;

/* Partikelfarben beim Tod, passend zur Farbe der Gegner */
const DEATH={larva:[0x8bdc5f,0x3f8a2c],drone:[0xffe066,0x9aa6b2,0xffb000],mutant:[0xb779e8,0x5b2e86,0xff4d3d],turret:[0xffe066,0x9aa6b2,0xff4d3d],
  hunter:[0x5fd3e6,0x227f92,0xffe066],walker:[0xffe066,0x9aa6b2,0x56616e],queen:[0xb779e8,0x8bdc5f,0xffe066]};

export class GameScene extends Phaser.Scene{
  constructor(){super('game')}

  create(){
    this.mapTex=this.textures.createCanvas('map',RW*T,RH*T);
    this.ctx=this.mapTex.getContext();this.ctx.imageSmoothingEnabled=false;
    this.add.image(0,0,'map').setOrigin(0).setDepth(0);
    this.gU=this.add.graphics().setDepth(1);
    this.gT=this.add.graphics().setDepth(6);

    const px=document.createElement('canvas');px.width=px.height=1;const pc=px.getContext('2d');pc.fillStyle='#fff';pc.fillRect(0,0,1,1);
    this.textures.addCanvas('px',px);
    this.emit=(colors,n,x,y,o={})=>{
      if(reduced())n=Math.ceil(n/3);
      const e=this.add.particles(0,0,'px',{speed:o.speed||{min:12,max:42},lifespan:o.life||{min:220,max:480},alpha:{start:1,end:0},
        gravityY:o.grav??60,tint:colors,emitting:false,quantity:n}).setDepth(7);
      e.explode(n,x,y);this.time.delayedCall(900,()=>e.destroy());
    };

    this.mons=new Map();   // id -> {img,tx,ty,t}
    this.itemPool=[];this.ghostPool=[];
    this.player={img:this.add.image(0,0,'px').setOrigin(0).setDepth(5).setVisible(false),tx:null,ty:null,cls:null};
    this.fx=[];this.roomKey='';

    this.offFx=on('fx',f=>this.onFx(f));
    this.offHurt=on('hurt',()=>{if(!reduced())this.cameras.main.shake(140,0.012)});
    this.offReset=on('reset',()=>{this.fx=[]});
    this.events.once('shutdown',()=>{this.offFx();this.offHurt();this.offReset()});

    this.input.on('pointerdown',p=>{if(!canInput())return;setHover(null);tileClick(Math.floor(p.worldX/T),Math.floor(p.worldY/T))});
    this.input.on('pointermove',p=>{if(p.wasTouch)return;const x=Math.floor(p.worldX/T),y=Math.floor(p.worldY/T);setHover(x>=0&&y>=0&&x<RW&&y<RH?{x,y}:null)});
    this.input.on('gameout',()=>setHover(null));
  }

  /* Sprite-Canvas einmalig als Textur registrieren */
  tex(key,canvas){if(!this.textures.exists(key))this.textures.addCanvas(key,canvas);return key}

  /* Figur zum Feld bewegen: ein Feld weit gleitet sie, weiter springt sie (Teleport, neuer Raum). */
  glide(o,x,y,snap){
    if(o.tx===x&&o.ty===y)return;
    const far=o.tx==null||cheb({x:o.tx,y:o.ty},{x,y})>1;
    o.tx=x;o.ty=y;this.tweens.killTweensOf(o.img);
    if(snap||far||reduced())o.img.setPosition(x*T,y*T);
    else this.tweens.add({targets:o.img,x:x*T,y:y*T,duration:75,ease:'Sine.easeOut'});
  }

  onFx(f){
    f.t0=this.time.now;this.fx.push(f);
    const cx=f.x*T+4,cy=f.y*T+4;
    if(f.type==='flash'){
      for(const o of this.mons.values())if(o.tx===f.x&&o.ty===f.y){o.img.setTintFill(0xffffff);this.time.delayedCall(90,()=>o.img.active&&o.img.clearTint())}
      this.emit([0xffffff,0xffe066],4,cx,cy,{speed:{min:20,max:50},life:{min:120,max:240},grav:0});
    }else if(f.type==='boom'){
      this.emit([0xff8a3d,0xffe066,0xff4d3d],26,cx,cy,{speed:{min:20,max:70},life:{min:250,max:560},grav:20});
      this.emit([0x56616e,0x2c343e],10,cx,cy,{speed:{min:5,max:18},life:{min:400,max:800},grav:-15});
      if(!reduced())this.cameras.main.shake(160,0.01);
    }else if(f.type==='line'){
      this.emit([hex(f.col),0xffffff],3,f.b.x*T+4,f.b.y*T+4,{speed:{min:10,max:30},life:{min:100,max:200},grav:0});
    }else if(f.type==='drop'){
      this.emit([0xffe066,0xffb000],6,cx,cy,{speed:{min:8,max:22},life:{min:200,max:400},grav:-10});
    }
  }

  update(time){
    const G=S.G,VIS=S.VIS,REACH=S.REACH;
    if(S.screen!=='game'||!G||!G.map.length)return;
    const key=G.seed+'|'+G.room+'|'+G.path;const newRoom=key!==this.roomKey;
    if(newRoom){this.roomKey=key;this.fx=[]}
    this.drawMap(time,G,VIS);
    const gU=this.gU,gT=this.gT;gU.clear();gT.clear();
    const p=G.p,busy=S.busy,hover=S.hover;
    const myTurn=G.phase==='player'&&!busy&&G.alive;

    // Reichweite und Weg zum Mauszeiger
    if(myTurn&&!G.target&&p.mp>0){gU.fillStyle(0x5fd3e6,.15);for(let i=0;i<RW*RH;i++)if(REACH[i]>0)gU.fillRect((i%RW)*T,((i/RW)|0)*T,8,8)}
    if(hover&&!busy&&!G.target&&G.alive&&(G.phase==='player'||G.phase==='explore')){
      const i=hover.x+hover.y*RW;
      if(REACH[i]>0){gU.fillStyle(0x5fd3e6,1);pathTo(i).forEach(j=>gU.fillRect((j%RW)*T+3,((j/RW)|0)*T+3,2,2));this.brackets(gT,hover.x*T,hover.y*T,0x5fd3e6)}
    }

    // Items
    const items=G.items.filter(it=>VIS[it.x+it.y*RW]);
    this.pool(this.itemPool,items.length,2).forEach((img,n)=>{const it=items[n];img.setTexture(this.tex(itemKey(it.k),itemSpr(it.k))).setPosition(it.x*T,it.y*T)});

    // Geister: zuletzt gesehene Position unsichtbarer Gegner
    const ghosts=G.mons.filter(m=>m.hp>0&&!VIS[m.x+m.y*RW]&&m.gx!=null);
    this.pool(this.ghostPool,ghosts.length,3).forEach((img,n)=>{const m=ghosts[n];img.setTexture(this.tex(monKey(m.t),monSpr(m.t))).setPosition(m.gx*T,m.gy*T).setAlpha(.28);
      gT.fillStyle(0x7f8c99,1);gT.fillRect(m.gx*T+3,m.gy*T,2,1)});

    // Gegner
    const seen=new Set();
    for(const m of G.mons){
      if(m.hp<=0)continue;seen.add(m.id);
      let o=this.mons.get(m.id);
      if(!o){o={img:this.add.image(m.x*T,m.y*T,this.tex(monKey(m.t),monSpr(m.t))).setOrigin(0).setDepth(4),tx:m.x,ty:m.y,t:m.t,vis:false};this.mons.set(m.id,o)}
      this.glide(o,m.x,m.y,newRoom);
      const vis=!!VIS[m.x+m.y*RW];
      if(vis&&!o.vis&&!newRoom){o.img.setAlpha(0);this.tweens.add({targets:o.img,alpha:1,duration:120})}
      o.vis=vis;o.img.setVisible(vis);
      if(!vis)continue;
      const sx=Math.round(o.img.x),sy=Math.round(o.img.y),d=MON[m.t];
      if(d.boss){gU.fillStyle(0xff4d3d,.18+.18*Math.sin(time/180));gU.fillRect(sx-1,sy-1,10,10)}
      if(m.elite){gU.fillStyle(0xffb000,.25);gU.fillRect(sx,sy,8,8)}
      if(m.stun>0&&((time/150)|0)%2){gT.fillStyle(0x5fd3e6,1);gT.fillRect(sx+1,sy,1,1);gT.fillRect(sx+6,sy+1,1,1)}
      if(m.aware&&m.stun<=0){gT.fillStyle(0xffb000,1);gT.fillRect(sx+7,sy,1,2);gT.fillRect(sx+7,sy+3,1,1)}
      if(m.hp<m.max){gT.fillStyle(0x3a1418,1);gT.fillRect(sx,sy+7,8,1);gT.fillStyle(0xff4d3d,1);gT.fillRect(sx,sy+7,Math.max(1,Math.round(8*m.hp/m.max)),1)}
      if(G.active===m.id)this.brackets(gT,sx,sy,0xffb000);
      else if(myTurn&&p.act>0&&!G.target&&(cheb(m,p)===1||(canShoot()&&shootable(m))))this.brackets(gT,sx,sy,0xff4d3d);
      if(G.target&&G.target.kind==='shoot'&&shootable(m))this.brackets(gT,sx,sy,((time/200)|0)%2?0xffb000:0xff4d3d);
    }
    // Verschwundene Gegner: im selben Raum gestorben -> Zerfall mit Partikeln, sonst einfach weg
    for(const [id,o] of this.mons){
      if(seen.has(id))continue;this.mons.delete(id);
      if(!newRoom&&o.vis){
        this.emit(DEATH[o.t]||[0xffffff],14,o.img.x+4,o.img.y+4,{speed:{min:10,max:40},life:{min:260,max:620},grav:50});
        this.tweens.killTweensOf(o.img);
        this.tweens.add({targets:o.img,alpha:0,scaleY:.2,y:o.img.y+6,duration:220,onComplete:()=>o.img.destroy()});
      }else o.img.destroy();
    }

    // Granaten-Zielbereich
    if(G.target&&G.target.kind==='nade'){
      gT.fillStyle(0xffb000,.12);for(let i=0;i<RW*RH;i++){const x=i%RW,y=(i/RW)|0;if(nadeOk(x,y))gT.fillRect(x*T,y*T,8,8)}
      if(hover&&nadeOk(hover.x,hover.y)){gT.fillStyle(0xff8a3d,.4);gT.fillRect((hover.x-1)*T,(hover.y-1)*T,24,24)}
    }

    // Spielerin
    const pl=this.player;
    if(pl.cls!==G.cls){pl.cls=G.cls;pl.img.setTexture(this.tex(playerKey(G.cls),playerSpr(G.cls)))}
    this.glide(pl,p.x,p.y,newRoom);
    pl.img.setVisible(G.alive).setAlpha(p.invis>0?.45:1);
    const ppx=Math.round(pl.img.x),ppy=Math.round(pl.img.y);
    if(!G.alive){gU.fillStyle(0x8f1f1a,1);gU.fillRect(ppx+1,ppy+5,6,2);gU.fillStyle(0xff4d3d,1);gU.fillRect(ppx+2,ppy+5,2,1)}
    if(p.shield>0){gT.lineStyle(1,0x5fd3e6,.55+.3*Math.sin(time/160));gT.strokeRect(ppx-.5,ppy-.5,9,9)}
    if(G.alive&&itemAt(p.x,p.y)){gT.fillStyle(((time/300)|0)%2?0xffe066:0xffb000,1);gT.fillRect(ppx+6,ppy+7,2,1);gT.fillRect(ppx+7,ppy+6,1,1)}
    if(performance.now()-S.hurtT<160){gT.fillStyle(0xff4d3d,.45);gT.fillRect(ppx,ppy,8,8)}

    // Kurzlebige Effekte
    this.fx=this.fx.filter(f=>time-f.t0<f.dur);
    for(const f of this.fx){const k=1-(time-f.t0)/f.dur;
      if(f.type==='flash'){gT.fillStyle(0xffffff,.5*k);gT.fillRect(f.x*T,f.y*T,8,8)}
      else if(f.type==='line'){
        const pts=line(f.a.x*T+4,f.a.y*T+4,f.b.x*T+4,f.b.y*T+4);
        const head=Math.min(pts.length,Math.ceil(pts.length*Math.min(1,(1-k)*3)));
        gT.fillStyle(hex(f.col),k);for(let n=0;n<head;n++)gT.fillRect(pts[n][0],pts[n][1],1,1);
        if(head>0){gT.fillStyle(0xffffff,k);const [hx,hy]=pts[head-1];gT.fillRect(hx,hy,1,1)}
      }
      else if(f.type==='drop'){gT.lineStyle(1,0xffe066,k);const r=2+(1-k)*5;gT.strokeRect(f.x*T+4-r,f.y*T+4-r,r*2,r*2)}
      else if(f.type==='boom'){gT.fillStyle(0xff8a3d,.6*k);gT.fillRect((f.x-1)*T,(f.y-1)*T,24,24);gT.fillStyle(0xffe066,k);gT.fillRect(f.x*T+2,f.y*T+2,4,4)}
      else if(f.type==='ring'){gT.lineStyle(1,0x5fd3e6,k);gT.strokeCircle(ppx+4,ppy+4,(1-k)*8*T)}
    }
  }

  /* Bildchen-Pool: genau n sichtbare Images zurückgeben */
  pool(arr,n,depth){
    while(arr.length<n)arr.push(this.add.image(0,0,'px').setOrigin(0).setDepth(depth));
    arr.forEach((img,i)=>img.setVisible(i<n).setAlpha(1));
    return arr.slice(0,n);
  }

  brackets(g,sx,sy,col){g.fillStyle(col,1);[[0,0,2,1],[0,0,1,2],[6,0,2,1],[7,0,1,2],[0,7,2,1],[0,6,1,2],[6,7,2,1],[7,6,1,2]].forEach(([a,b,w,h])=>g.fillRect(sx+a,sy+b,w,h))}

  /* Raum malen: gleiche Kacheln wie in der klassischen Version */
  drawMap(now,G,VIS){
    const ctx=this.ctx;
    ctx.fillStyle='#000';ctx.fillRect(0,0,RW*T,RH*T);
    for(let y=0;y<RH;y++)for(let x=0;x<RW;x++){const i=x+y*RW;this.drawTile(ctx,G,G.map[i],i,x*T,y*T,now);if(!VIS[i]&&G.map[i]===FLOOR){ctx.fillStyle='rgba(3,5,8,.5)';ctx.fillRect(x*T,y*T,8,8)}}
    this.mapTex.refresh();
  }
  drawTile(ctx,G,t,i,sx,sy,now){
    const deco=G.deco[i],tier=tierOf(G.room);
    if(t===WALL){
      const below=i+RW<RW*RH?G.map[i+RW]:WALL;const face=below===FLOOR||below===BLOCK;
      ctx.fillStyle='#2d3743';ctx.fillRect(sx,sy,8,8);ctx.fillStyle='#3e4a58';ctx.fillRect(sx,sy,8,1);
      if(face){ctx.fillStyle='#212932';ctx.fillRect(sx,sy+5,8,3);ctx.fillStyle='#4a5868';ctx.fillRect(sx,sy+4,8,1);
        if(deco<.12){ctx.fillStyle=(((now/600)+deco*13)|0)%2?'#5fd3e6':'#227f92';ctx.fillRect(sx+2,sy+1,4,2)}}
      else{ctx.fillStyle='#262f3a';ctx.fillRect(sx+1,sy+2,6,5)}
      return;
    }
    ctx.fillStyle=FLOORTINT[tier-1];ctx.fillRect(sx,sy,8,8);
    ctx.fillStyle='rgba(0,0,0,.35)';ctx.fillRect(sx+7,sy,1,8);ctx.fillRect(sx,sy+7,8,1);
    if(t===FLOOR){
      if(deco>.88){ctx.fillStyle='rgba(0,0,0,.42)';for(let k=1;k<7;k+=2)ctx.fillRect(sx+1,sy+k,6,1)}
      else if(deco<.3){ctx.fillStyle='rgba(255,255,255,.08)';ctx.fillRect(sx+1,sy+1,1,1)}
      else if(tier===4&&deco>.7){ctx.fillStyle='rgba(139,220,95,.14)';ctx.fillRect(sx+2,sy+3,3,2)}
      return;
    }
    if(t===BLOCK){
      if(G.boss){ctx.fillStyle='#3a2a44';ctx.fillRect(sx,sy,8,8);ctx.fillStyle='#5b2e86';ctx.fillRect(sx+1,sy+1,6,5);ctx.fillStyle='#8bdc5f';ctx.fillRect(sx+3,sy+2,2,2);return}
      if(deco<.45){ctx.fillStyle='#6b5a3a';ctx.fillRect(sx,sy+1,8,7);ctx.fillStyle='#8a7449';ctx.fillRect(sx,sy+1,8,1);ctx.fillStyle='#4a3e28';ctx.fillRect(sx+1,sy+3,6,1);ctx.fillRect(sx+1,sy+5,6,1);ctx.fillRect(sx+3,sy+2,1,6)}
      else if(deco<.75){ctx.fillStyle='#3a4553';ctx.fillRect(sx,sy+1,8,7);ctx.fillStyle='#56616e';ctx.fillRect(sx,sy+1,8,1);ctx.fillStyle=((now/700+deco*9)|0)%2?'#5fd3e6':'#227f92';ctx.fillRect(sx+1,sy+3,6,3)}
      else{ctx.fillStyle='#4a5563';ctx.fillRect(sx+1,sy,6,8);ctx.fillStyle='#7a8794';ctx.fillRect(sx+2,sy,1,8);ctx.fillStyle='#ffb000';ctx.fillRect(sx+1,sy+3,6,1)}
      return;
    }
    if(t===DOOR){ctx.fillStyle='#56616e';ctx.fillRect(sx,sy,8,8);for(let py=1;py<7;py++)for(let px=1;px<7;px++){ctx.fillStyle=(((px+py)>>1)&1)?'#ffb000':'#14181e';ctx.fillRect(sx+px,sy+py,1,1)}return}
    if(t===EXIT){const pulse=.5+.5*Math.sin(now/260);ctx.fillStyle='#05070a';ctx.fillRect(sx,sy,8,8);ctx.fillStyle=`rgba(255,176,0,${.45+.55*pulse})`;ctx.fillRect(sx,sy,8,1);ctx.fillRect(sx,sy+7,8,1);ctx.fillRect(sx,sy,1,8);ctx.fillRect(sx+7,sy,1,8);ctx.fillRect(sx+3,sy+3,2,2);return}
    if(t===POD){ctx.fillStyle='#d7dde3';ctx.fillRect(sx+1,sy+1,6,6);ctx.fillRect(sx+2,sy,4,8);ctx.fillStyle='#227f92';ctx.fillRect(sx+2,sy+2,4,3);ctx.fillStyle=(G.bossDead&&G.phase==='explore')?((now/300|0)%2?'#8bdc5f':'#3f8a2c'):'#ff4d3d';ctx.fillRect(sx+3,sy+6,2,1);return}
  }
}
