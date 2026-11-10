// Phaser-Szene: zeichnet den Raum, Figuren, Licht, Markierungen und Effekte.
// Sie liest den Zustand aus game.js und verändert ihn nie selbst, außer über die
// gleichen Aktionen, die auch Tastatur und Knöpfe benutzen (tileClick, setHover).
//
// Ebenen (depth):
//   0    Raum (Canvas-Textur, jedes Bild neu gemalt: Kacheln, Lampen, Bildschirme, Nebel)
//   1    Unter-Markierungen (Schatten, Reichweite, Weg, Leuchten unter Boss und Elite)
//   2    Items   3 Geister (zuletzt gesehene Gegner)   4 Gegner   4.2 Spielerin
//   4.5  Dunkelheit (RenderTexture, Lichtquellen radieren sie aus)
//   4.6  farbiges Licht (additiv)
//   6    Ober-Markierungen (Rahmen, Lebensbalken, Zielbereiche, Schüsse)
//   7    Partikel
import Phaser from 'phaser';
import {RW,RH,MON,FLOOR} from '../core/config.js';
import {cheb,line} from '../core/geometry.js';
import {S,canInput,canShoot,shootable,nadeOk,pathTo,itemAt,tileClick,setHover} from '../core/game.js';
import {on} from '../core/bus.js';
import {TS,spr,itemSpr,monSpr,playerSpr,itemKey,monKey,playerKey} from './sprites.js';
import {drawTile,envLights} from './tiles.js';

const hex=c=>parseInt(c.slice(1),16);
const reduced=()=>typeof matchMedia==='function'&&matchMedia('(prefers-reduced-motion: reduce)').matches;
const AMBIENT=.5;   // Grunddunkelheit der Station (0 = hell, 1 = schwarz)

/* Partikelfarben beim Tod, passend zur Farbe der Gegner */
const DEATH={larva:[0x8bdc5f,0x3f8a2c],drone:[0xffe066,0x9aa6b2,0xffb000],mutant:[0xb779e8,0x5b2e86,0xff4d3d],turret:[0xffe066,0x9aa6b2,0xff4d3d],
  hunter:[0x5fd3e6,0x227f92,0xffe066],walker:[0xffe066,0x9aa6b2,0x56616e],queen:[0xb779e8,0x8bdc5f,0xffe066],
  spitter:[0x8bdc5f,0x3f8a2c,0xff4d3d],breaker:[0xb779e8,0x5b2e86,0x9aa6b2]};
/* Geschütz des Ingenieurs: das Geschütz-Sprite mit blauem Licht */
const SENTRY_MAP={r:'#5fd3e6',R:'#227f92'};
const HOVER={drone:1};   // schwebt: kleiner, blasser Schatten

export class GameScene extends Phaser.Scene{
  constructor(){super('game')}

  create(){
    const W=RW*TS,H=RH*TS;
    this.mapTex=this.textures.createCanvas('map',W,H);
    this.ctx=this.mapTex.getContext();this.ctx.imageSmoothingEnabled=false;
    this.add.image(0,0,'map').setOrigin(0).setDepth(0);
    this.gU=this.add.graphics().setDepth(1);
    this.gT=this.add.graphics().setDepth(6);

    // Texturen: 1-Pixel-Partikel und weicher Lichtkreis
    const px=document.createElement('canvas');px.width=px.height=1;const pc=px.getContext('2d');pc.fillStyle='#fff';pc.fillRect(0,0,1,1);
    this.textures.addCanvas('px',px);
    const lc=document.createElement('canvas');lc.width=lc.height=64;const lx=lc.getContext('2d');
    const grd=lx.createRadialGradient(32,32,0,32,32,32);
    grd.addColorStop(0,'rgba(255,255,255,1)');grd.addColorStop(.35,'rgba(255,255,255,.75)');grd.addColorStop(.7,'rgba(255,255,255,.25)');grd.addColorStop(1,'rgba(255,255,255,0)');
    lx.fillStyle=grd;lx.fillRect(0,0,64,64);
    this.textures.addCanvas('light',lc);

    // Dunkelheit und farbiges Licht
    this.dark=this.add.renderTexture(0,0,W,H).setOrigin(0).setDepth(4.5);
    this.lightStamp=this.make.image({x:0,y:0,key:'light',add:false});
    this.glowPool=[];

    this.emit=(colors,n,x,y,o={})=>{
      if(reduced())n=Math.ceil(n/3);
      const e=this.add.particles(0,0,'px',{speed:o.speed||{min:20,max:70},lifespan:o.life||{min:240,max:520},alpha:{start:1,end:0},
        scale:o.scale||{start:1,end:1},gravityY:o.grav??90,tint:colors,emitting:false,quantity:n}).setDepth(7);
      e.explode(n,x,y);this.time.delayedCall(1000,()=>e.destroy());
    };

    this.mons=new Map();   // id -> Figur
    this.itemPool=[];this.ghostPool=[];
    this.player=this.figure(this.add.image(0,0,'px').setOrigin(0).setDepth(4.2).setVisible(false));
    this.fx=[];this.flashes=[];this.roomKey='';

    const offs=[
      on('fx',f=>this.onFx(f)),
      on('hurt',()=>this.onHurt()),
      on('reset',()=>{this.fx=[];this.flashes=[];this.roomKey=''}),
      on('filter',v=>this.setFilter(v)),
    ];
    this.events.once('shutdown',()=>offs.forEach(f=>f()));

    this.input.on('pointerdown',p=>{if(!canInput())return;setHover(null);tileClick(Math.floor(p.worldX/TS),Math.floor(p.worldY/TS))});
    this.input.on('pointermove',p=>{if(p.wasTouch)return;const x=Math.floor(p.worldX/TS),y=Math.floor(p.worldY/TS);setHover(x>=0&&y>=0&&x<RW&&y<RH?{x,y}:null)});
    this.input.on('gameout',()=>setHover(null));

    this.fxOn=null;this.setFilter(this.registry.get('filter')!==false);
  }

  /* Bildfilter: kräftiges Leuchten um Lichtquellen (die Scanlines kommen per CSS, siehe .crt).
     Bewusst kein Bloom über das ganze Bild: Der würde die Pixel weichzeichnen. */
  setFilter(on){this.fxOn=on}

  /* Eine Figur: Grundposition (bx/by, gleitet), Hüpfer, Stoß-Versatz und Blickrichtung */
  figure(img){return{img,tx:null,ty:null,bx:0,by:0,hop:0,ox:0,oy:0,face:1,vis:false}}
  place(o){o.img.setPosition(Math.round(o.bx+o.ox),Math.round(o.by+o.oy-o.hop)).setFlipX(o.face<0)}

  /* Zum Feld bewegen: ein Feld weit gleitet und hüpft die Figur, weiter springt sie (Teleport, neuer Raum). */
  glide(o,x,y,snap){
    if(o.tx===x&&o.ty===y)return;
    const far=o.tx==null||cheb({x:o.tx,y:o.ty},{x,y})>1;
    if(o.tx!=null&&x!==o.tx)o.face=x>o.tx?1:-1;
    o.tx=x;o.ty=y;
    if(o.tw)o.tw.stop();
    if(snap||far||reduced()){o.bx=x*TS;o.by=y*TS;o.hop=0;return}
    const fx0=o.bx,fy0=o.by,p={t:0};
    o.tw=this.tweens.add({targets:p,t:1,duration:110,ease:'Sine.easeInOut',onUpdate:()=>{o.bx=fx0+(x*TS-fx0)*p.t;o.by=fy0+(y*TS-fy0)*p.t;o.hop=Math.sin(Math.PI*p.t)*2.5},
      onComplete:()=>{o.bx=x*TS;o.by=y*TS;o.hop=0;o.tw=null}});
  }
  /* Ausfallschritt Richtung Ziel (Angriff) */
  lunge(o,tx,ty){
    if(!o||reduced())return;const dx=Math.sign(tx-o.tx),dy=Math.sign(ty-o.ty);if(dx)o.face=dx;
    this.tweens.add({targets:o,ox:dx*4,oy:dy*4,duration:60,yoyo:true,ease:'Quad.easeOut',onComplete:()=>{o.ox=0;o.oy=0}});
  }
  monsterAt(x,y){for(const o of this.mons.values())if(o.tx===x&&o.ty===y)return o;return null}

  onHurt(){
    const G=S.G;
    if(G&&G.active!=null){const m=this.mons.get(G.active);if(m&&cheb({x:m.tx,y:m.ty},G.p)===1)this.lunge(m,G.p.x,G.p.y)}
    if(!reduced())this.cameras.main.shake(150,0.012);
    const o=this.player;o.img.setTintFill(0xff4d3d);this.time.delayedCall(110,()=>o.img.active&&o.img.clearTint());
    this.emit([0xff4d3d,0x8f1f1a],6,o.bx+8,o.by+8,{speed:{min:20,max:60},life:{min:200,max:400}});
  }

  onFx(f){
    f.t0=this.time.now;this.fx.push(f);
    const cx=f.x*TS+8,cy=f.y*TS+8,G=S.G;
    if(f.type==='flash'){
      const o=this.monsterAt(f.x,f.y);
      if(o){o.img.setTintFill(0xffffff);this.time.delayedCall(90,()=>o.img.active&&o.img.clearTint())}
      if(G&&cheb(G.p,f)===1&&!this.fx.some(e=>e.type==='line'&&this.time.now-e.t0<30))this.lunge(this.player,f.x,f.y);
      this.emit([0xffffff,0xffe066],6,cx,cy,{speed:{min:30,max:80},life:{min:120,max:260},grav:0});
    }else if(f.type==='boom'){
      this.emit([0xff8a3d,0xffe066,0xff4d3d],34,cx,cy,{speed:{min:30,max:120},life:{min:250,max:600},grav:30});
      this.emit([0x56616e,0x2c343e],14,cx,cy,{speed:{min:8,max:30},life:{min:500,max:900},grav:-20,scale:{start:2,end:1}});
      if(!reduced())this.cameras.main.shake(180,0.014);
    }else if(f.type==='line'){
      this.emit([hex(f.col),0xffffff],5,f.b.x*TS+8,f.b.y*TS+8,{speed:{min:20,max:50},life:{min:100,max:220},grav:0});
      // Mündungsfeuer am Schützen
      const sx=f.a.x*TS+8,sy=f.a.y*TS+8;this.flashes.push({x:sx,y:sy,col:hex(f.col),t0:this.time.now,dur:120,r:40});
      const shooter=G&&(G.p.x===f.a.x&&G.p.y===f.a.y?this.player:this.monsterAt(f.a.x,f.a.y));
      if(shooter&&f.b.x!==f.a.x)shooter.face=f.b.x>f.a.x?1:-1;
    }else if(f.type==='drop'){
      this.emit([0xffe066,0xffb000],8,cx,cy,{speed:{min:10,max:30},life:{min:240,max:460},grav:-20});
    }else if(f.type==='ring'){
      this.flashes.push({x:cx,y:cy,col:0x5fd3e6,t0:this.time.now,dur:450,r:120});
    }
  }

  update(time){
    const G=S.G,VIS=S.VIS,REACH=S.REACH;
    if(S.screen!=='game'||!G||!G.map.length)return;
    const key=G.seed+'|'+G.room+'|'+G.path;const newRoom=key!==this.roomKey;
    if(newRoom){this.roomKey=key;this.fx=[];this.flashes=[]}
    this.drawMap(time,G,VIS);
    const gU=this.gU,gT=this.gT;gU.clear();gT.clear();
    const p=G.p,busy=S.busy,hover=S.hover;
    const myTurn=G.phase==='player'&&!busy&&G.alive;
    const lights=envLights(G,time);

    // Reichweite und Weg zum Mauszeiger
    if(myTurn&&!G.target&&p.mp>0){gU.fillStyle(0x5fd3e6,.16);for(let i=0;i<RW*RH;i++)if(REACH[i]>0)gU.fillRect((i%RW)*TS,((i/RW)|0)*TS,TS,TS)}
    if(hover&&!busy&&!G.target&&G.alive&&(G.phase==='player'||G.phase==='explore')){
      const i=hover.x+hover.y*RW;
      if(REACH[i]>0){gT.fillStyle(0x5fd3e6,.9);pathTo(i).forEach(j=>gT.fillRect((j%RW)*TS+7,((j/RW)|0)*TS+7,2,2));this.brackets(gT,hover.x*TS,hover.y*TS,0x5fd3e6)}
    }

    // Items (mit leichtem Schimmer)
    // dazu ausgelegte Minen (liegen still) und das Geschütz des Ingenieurs
    const items=G.items.filter(it=>VIS[it.x+it.y*RW]).map(it=>({x:it.x,y:it.y,key:itemKey(it.k),cv:itemSpr(it.k),bob:1,col:0xffe066,i:.3,r:18}));
    for(const m of G.mines||[])if(VIS[m.x+m.y*RW])items.push({x:m.x,y:m.y,key:'mine_set',cv:itemSpr('mine'),bob:0,col:0xff4d3d,i:.25+.15*Math.sin(time/250),r:14});
    if(G.sentry){const f=((time/400)|0)%2,s=G.sentry;items.push({x:s.x,y:s.y,key:'sentry#'+f,cv:spr('turret',SENTRY_MAP,'sentry',f),bob:0,col:0x5fd3e6,i:.6,r:34})}
    this.pool(this.itemPool,items.length,2).forEach((img,n)=>{const it=items[n];
      img.setTexture(this.tex(it.key,it.cv)).setPosition(it.x*TS,it.y*TS-(it.bob?Math.round(Math.sin(time/400+n)):0));
      lights.push({x:it.x*TS+8,y:it.y*TS+8,r:it.r,col:it.col,i:it.i})});

    // Geister: zuletzt gesehene Position unsichtbarer Gegner
    const ghosts=G.mons.filter(m=>m.hp>0&&!VIS[m.x+m.y*RW]&&m.gx!=null);
    this.pool(this.ghostPool,ghosts.length,3).forEach((img,n)=>{const m=ghosts[n];img.setTexture(this.tex(monKey(m.t),monSpr(m.t))).setPosition(m.gx*TS,m.gy*TS).setAlpha(.3);
      gT.fillStyle(0x7f8c99,.8);gT.fillRect(m.gx*TS+6,m.gy*TS,4,1)});

    // Gegner
    const seen=new Set();
    for(const m of G.mons){
      if(m.hp<=0)continue;seen.add(m.id);
      let o=this.mons.get(m.id);
      if(!o){o=this.figure(this.add.image(0,0,'px').setOrigin(0).setDepth(4));o.t=m.t;o.phase=(m.id*0.37)%1;this.mons.set(m.id,o)}
      this.glide(o,m.x,m.y,newRoom);
      if(o.tx!=null&&m.x!==p.x&&!o.tw)o.face=p.x<m.x?-1:1;
      const f=m.stun>0?0:(((time/520)+o.phase)|0)%2;
      o.img.setTexture(this.tex(monKey(m.t,f),monSpr(m.t,f)));
      const vis=!!VIS[m.x+m.y*RW];
      if(vis&&!o.vis&&!newRoom){o.img.setAlpha(0);this.tweens.add({targets:o.img,alpha:1,duration:140})}
      o.vis=vis;o.img.setVisible(vis);this.place(o);
      if(!vis)continue;
      const sx=Math.round(o.bx),sy=Math.round(o.by),d=MON[m.t];
      gU.fillStyle(0x000000,HOVER[m.t]?.2:.38);gU.fillEllipse(sx+8,sy+15,HOVER[m.t]?8:12,3);
      lights.push({x:sx+8,y:sy+8,r:d.boss?76:28,col:d.boss?0xff4d3d:0xffffff,i:d.boss?.75+.2*Math.sin(time/180):.38});
      if(m.elite){gU.fillStyle(0xffb000,.22);gU.fillEllipse(sx+8,sy+12,16,8)}
      if(m.stun>0){gT.fillStyle(0x5fd3e6,1);const a=time/160;for(let k=0;k<3;k++){const ang=a+k*2.1;gT.fillRect(sx+8+Math.round(Math.cos(ang)*6),sy+1+Math.round(Math.sin(ang)*2),1,1)}}
      if(m.aware&&m.stun<=0){gT.fillStyle(0xffb000,1);gT.fillRect(sx+14,sy,1,3);gT.fillRect(sx+14,sy+4,1,1)}
      if(m.hp<m.max){gT.fillStyle(0x3a1418,1);gT.fillRect(sx+1,sy+15,14,1);gT.fillStyle(0xff4d3d,1);gT.fillRect(sx+1,sy+15,Math.max(1,Math.round(14*m.hp/m.max)),1)}
      if(G.active===m.id)this.brackets(gT,sx,sy,0xffb000);
      else if(myTurn&&p.act>0&&!G.target&&(cheb(m,p)===1||(canShoot()&&shootable(m))))this.brackets(gT,sx,sy,0xff4d3d);
      if(G.target&&G.target.kind==='shoot'&&shootable(m))this.brackets(gT,sx,sy,((time/200)|0)%2?0xffb000:0xff4d3d);
    }
    // Verschwundene Gegner: im selben Raum gestorben -> Zerfall mit Partikeln, sonst einfach weg
    for(const [id,o] of this.mons){
      if(seen.has(id))continue;this.mons.delete(id);if(o.tw)o.tw.stop();
      if(!newRoom&&o.vis){
        this.emit(DEATH[o.t]||[0xffffff],22,o.bx+8,o.by+8,{speed:{min:20,max:80},life:{min:300,max:700},grav:80});
        this.flashes.push({x:o.bx+8,y:o.by+8,col:0xffffff,t0:time,dur:180,r:40});
        this.tweens.add({targets:o.img,alpha:0,scaleY:.15,y:o.img.y+12,duration:240,onComplete:()=>o.img.destroy()});
      }else o.img.destroy();
    }

    // Granaten-Zielbereich
    if(G.target&&G.target.kind==='nade'){
      gT.fillStyle(0xffb000,.12);for(let i=0;i<RW*RH;i++){const x=i%RW,y=(i/RW)|0;if(nadeOk(x,y))gT.fillRect(x*TS,y*TS,TS,TS)}
      if(hover&&nadeOk(hover.x,hover.y)){gT.fillStyle(0xff8a3d,.35);gT.fillRect((hover.x-1)*TS,(hover.y-1)*TS,TS*3,TS*3)}
    }

    // Spielerin
    const pl=this.player;
    this.glide(pl,p.x,p.y,newRoom);
    const pf=G.alive?(((time/600)|0)%2):0;
    pl.img.setTexture(this.tex(playerKey(G.cls,pf),playerSpr(G.cls,pf)));
    pl.img.setVisible(G.alive).setAlpha(p.invis>0?.4+.1*Math.sin(time/120):1);this.place(pl);
    const ppx=Math.round(pl.bx),ppy=Math.round(pl.by);
    if(G.alive){gU.fillStyle(0x000000,.4);gU.fillEllipse(ppx+8,ppy+15,12,3)}
    else{gU.fillStyle(0x8f1f1a,1);gU.fillRect(ppx+3,ppy+11,10,3);gU.fillStyle(0xff4d3d,1);gU.fillRect(ppx+5,ppy+11,4,1)}
    lights.push({x:ppx+8,y:ppy+8,r:104,col:0xffe2b0,i:1});
    if(p.shield>0){gT.lineStyle(1,0x5fd3e6,.55+.3*Math.sin(time/160));gT.strokeCircle(ppx+8,ppy+8,10);lights.push({x:ppx+8,y:ppy+8,r:30,col:0x5fd3e6,i:.4})}
    if(G.alive&&itemAt(p.x,p.y)){gT.fillStyle(((time/300)|0)%2?0xffe066:0xffb000,1);gT.fillRect(ppx+12,ppy+14,3,1);gT.fillRect(ppx+14,ppy+12,1,3)}

    // Kurzlebige Effekte
    this.fx=this.fx.filter(f=>time-f.t0<f.dur);
    for(const f of this.fx){const k=1-(time-f.t0)/f.dur;
      if(f.type==='flash'){gT.fillStyle(0xffffff,.45*k);gT.fillRect(f.x*TS,f.y*TS,TS,TS)}
      else if(f.type==='line'){
        const pts=line(f.a.x*TS+8,f.a.y*TS+8,f.b.x*TS+8,f.b.y*TS+8);
        const head=Math.min(pts.length,Math.ceil(pts.length*Math.min(1,(1-k)*3)));
        gT.fillStyle(hex(f.col),k);for(let n=Math.max(0,head-14);n<head;n++)gT.fillRect(pts[n][0],pts[n][1],1,1);
        if(head>0){const [hx,hy]=pts[head-1];gT.fillStyle(0xffffff,k);gT.fillRect(hx-1,hy,2,1);lights.push({x:hx,y:hy,r:34,col:hex(f.col),i:.8*k})}
      }
      else if(f.type==='drop'){gT.lineStyle(1,0xffe066,k);const r=3+(1-k)*9;gT.strokeRect(f.x*TS+8-r,f.y*TS+8-r,r*2,r*2)}
      else if(f.type==='boom'){lights.push({x:f.x*TS+8,y:f.y*TS+8,r:110*k+20,col:0xff8a3d,i:k});gT.fillStyle(0xffe066,k);gT.fillRect(f.x*TS+5,f.y*TS+5,6,6)}
      else if(f.type==='ring'){gT.lineStyle(1,0x5fd3e6,k);gT.strokeCircle(ppx+8,ppy+8,(1-k)*8*TS)}
    }
    this.flashes=this.flashes.filter(f=>time-f.t0<f.dur);
    for(const f of this.flashes){const k=1-(time-f.t0)/f.dur;lights.push({x:f.x,y:f.y,r:f.r,col:f.col,i:k})}

    this.drawLight(lights,G.event==='dark'?.78:AMBIENT);
  }

  /* Dunkelheit füllen und an jeder Lichtquelle ausradieren; dazu farbiges Licht additiv */
  drawLight(lights,ambient=AMBIENT){
    const dk=this.dark,st=this.lightStamp;
    dk.clear();dk.fill(0x04060a,ambient);
    for(const l of lights){st.setScale(l.r/32).setAlpha(Math.min(1,l.i));dk.erase(st,l.x,l.y)}
    while(this.glowPool.length<lights.length)this.glowPool.push(this.add.image(0,0,'light').setDepth(4.6).setBlendMode(Phaser.BlendModes.ADD));
    this.glowPool.forEach((g,n)=>{const l=lights[n];if(!l){g.setVisible(false);return}
      const strong=this.fxOn?1:.45;
      g.setVisible(true).setPosition(l.x,l.y).setScale(l.r/32*.8).setTint(l.col).setAlpha(l.col===0xffe2b0?.05*strong:.38*strong*Math.min(1,l.i))});
  }

  /* Sprite-Canvas einmalig als Textur registrieren */
  tex(key,canvas){if(!this.textures.exists(key))this.textures.addCanvas(key,canvas);return key}

  /* Bildchen-Pool: genau n sichtbare Images zurückgeben */
  pool(arr,n,depth){
    while(arr.length<n)arr.push(this.add.image(0,0,'px').setOrigin(0).setDepth(depth));
    arr.forEach((img,i)=>img.setVisible(i<n).setAlpha(1));
    return arr.slice(0,n);
  }

  brackets(g,sx,sy,col){g.fillStyle(col,1);[[0,0,3,1],[0,0,1,3],[13,0,3,1],[15,0,1,3],[0,15,3,1],[0,13,1,3],[13,15,3,1],[15,13,1,3]].forEach(([a,b,w,h])=>g.fillRect(sx+a,sy+b,w,h))}

  /* Raum malen, nicht sichtbare Bodenfelder abdunkeln */
  drawMap(now,G,VIS){
    const ctx=this.ctx;
    ctx.fillStyle='#000';ctx.fillRect(0,0,RW*TS,RH*TS);
    for(let y=0;y<RH;y++)for(let x=0;x<RW;x++){const i=x+y*RW;drawTile(ctx,G,G.map[i],i,x*TS,y*TS,now);if(!VIS[i]&&G.map[i]===FLOOR){ctx.fillStyle='rgba(3,5,8,.45)';ctx.fillRect(x*TS,y*TS,TS,TS)}}
    this.mapTex.refresh();
  }
}
