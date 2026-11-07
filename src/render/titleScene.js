// Titelbild „Station im Orbit“: die zerstörte IKARUS-7 vor dem Planeten Kepler-442b.
// Pixel-Art, Bild für Bild auf einen kleinen Canvas gemalt (Sterne funkeln, Wolken ziehen,
// Notsignal blinkt, Fenster flackern, Gas tritt aus, Trümmer treiben, ab und zu eine Sternschnuppe).
// Eigenständig ohne Importe, damit auch das Vorschaubild (scripts/og/) es nutzen kann.

function mulberry(seed){let a=seed>>>0;return()=>{a=(a+0x6D2B79F5)|0;let t=Math.imul(a^a>>>15,1|a);t=t+Math.imul(t^t>>>7,61|t)^t;return((t^t>>>14)>>>0)/4294967296}}
const BAYER=[0,8,2,10,12,4,14,6,3,11,1,9,15,7,13,5].map(v=>(v+.5)/16);
const hexRGB=h=>[parseInt(h.slice(1,3),16),parseInt(h.slice(3,5),16),parseInt(h.slice(5,7),16)];

/* Planetenoberfläche: Meer, Land, Eis, Wolken – je 5 Helligkeitsstufen */
const SURF={
  sea:['#05090d','#0c2230','#123a4a','#1d566a','#2f7a8a'].map(hexRGB),
  land:['#05090d','#132a1f','#24503a','#3b7350','#5c9365'].map(hexRGB),
  ice:['#05090d','#2c3a44','#6f8792','#b3c8cf','#e4f0f2'].map(hexRGB),
  cloud:['#05090d','#2a3a44','#6a8a94','#a9c6cc','#dcecee'].map(hexRGB),
};

export function createTitleScene(W=400,H=150,seed=7){
  const r=mulberry(seed);
  // Wertrauschen für die Planetentextur (kachelt horizontal)
  const TW=256,TH=128;const grid=(n)=>Array.from({length:n*n},()=>r());
  const oct=[[8,grid(8)],[16,grid(16)],[32,grid(32)]];
  const noise=(u,v,[n,g])=>{const x=u*n,y=v*n,x0=Math.floor(x),y0=Math.floor(y),fx=x-x0,fy=y-y0,s=t=>t*t*(3-2*t);
    const at=(i,j)=>g[((j%n+n)%n)*n+((i%n+n)%n)];
    const a=at(x0,y0),b=at(x0+1,y0),c=at(x0,y0+1),d=at(x0+1,y0+1);return a+(b-a)*s(fx)+(c-a)*s(fy)+(a-b-c+d)*s(fx)*s(fy)};
  const land=new Float32Array(TW*TH),cloud=new Float32Array(TW*TH);
  for(let j=0;j<TH;j++)for(let i=0;i<TW;i++){const u=i/TW,v=j/TH;
    land[j*TW+i]=noise(u,v,oct[0])*.55+noise(u,v,oct[1])*.3+noise(u,v,oct[2])*.15;
    cloud[j*TW+i]=noise(u+.3,v*2.2,oct[1])*.45+noise(u*2%1,v*3%1,oct[2])*.55}

  // Sterne (feste Positionen), einige funkeln
  const stars=Array.from({length:Math.round(W*H/380)},()=>({x:(r()*W)|0,y:(r()*H)|0,b:.25+r()*.75,tw:r()<.22,ph:r()*6.28,
    col:r()<.12?[255,214,140]:r()<.25?[150,220,235]:[220,230,240],big:r()<.05}));
  // Nebelschleier links oben
  const neb=Array.from({length:3},()=>({x:r()*W*.4,y:r()*H*.6,rx:30+r()*40,ry:12+r()*18}));
  // Trümmer
  const SHAPES=[[[0,0],[1,0],[0,1]],[[0,0],[1,1]],[[0,0],[1,0],[2,0],[1,1]],[[0,0],[0,1],[1,1],[2,1]],[[0,0]]];
  const debris=Array.from({length:11},()=>({x:r(),y:r(),vx:(r()-.5)*.6,vy:(r()-.3)*.25,s:(r()*SHAPES.length)|0,rot:.3+r()*1.2,
    col:r()<.5?'#56616e':r()<.5?'#7a8794':'#3e4a58'}));

  const img=new ImageData(W,H);
  const P={cx:W-38,cy:H+62,R:Math.round(W*.355)};  // Planet unten rechts, Größe hängt nur an der Breite
  // Station: wird auf eine eigene Ebene gezeichnet und dann um ANGLE gedreht eingesetzt.
  // PIV = Drehpunkt in Stationskoordinaten (Mitte des Hauptmoduls), POS = wo er in der Szene liegt.
  const ANGLE=30*Math.PI/180;                         // im Uhrzeigersinn: die Station kippt Richtung Planet
  const LW=160,LH=76,LOX=10,LOY=4;                    // Ebene und Versatz der Stationskoordinaten darin
  const PIV={x:78,y:35},POS={x:Math.round(W*.655),y:66};
  const layer=typeof OffscreenCanvas!=='undefined'?new OffscreenCanvas(LW,LH):Object.assign(document.createElement('canvas'),{width:LW,height:LH});
  const lctx=layer.getContext('2d');
  let up=null,upW=0,upH=0,lastLayer=-1;               // 4-fach hochskalierte Ebene (Scale2x zweimal)
  const COS=Math.cos(ANGLE),SIN=Math.sin(ANGLE);
  /* Stationspunkt (lokal) -> Szenenpunkt */
  const toScene=(lx,ly)=>{const vx=lx-PIV.x,vy=ly-PIV.y;return{x:POS.x+vx*COS-vy*SIN,y:POS.y+vx*SIN+vy*COS}};
  const L=[-.72,-.6,.12];   // Licht schräg von hinten links oben: nur eine Sichel des Planeten leuchtet{const l=Math.hypot(...L);L[0]/=l;L[1]/=l;L[2]/=l}

  function background(t){
    const d=img.data;
    for(let y=0;y<H;y++)for(let x=0;x<W;x++){
      const k=(y*W+x)*4,g=y/H;
      let R=5+g*5,G=7+g*8,B=11+g*13;
      for(const n of neb){const dx=(x-n.x)/n.rx,dy=(y-n.y)/n.ry,q=dx*dx+dy*dy;if(q<1){const a=(1-q)*.55;if(a>BAYER[(y&3)*4+(x&3)]*.9){R+=10;G+=6;B+=22}}}
      d[k]=R;d[k+1]=G;d[k+2]=B;d[k+3]=255;
    }
    for(const s of stars){
      let b=s.b;if(s.tw)b*=.45+.55*(.5+.5*Math.sin(t*2.1+s.ph));
      const put=(x,y,f)=>{if(x<0||y<0||x>=W||y>=H)return;const k=(y*W+x)*4;d[k]=Math.max(d[k],s.col[0]*f);d[k+1]=Math.max(d[k+1],s.col[1]*f);d[k+2]=Math.max(d[k+2],s.col[2]*f)};
      put(s.x,s.y,b);if(s.big&&b>.6){put(s.x+1,s.y,b*.45);put(s.x-1,s.y,b*.45);put(s.x,s.y+1,b*.45);put(s.x,s.y-1,b*.45)}
    }
  }

  function planet(t){
    const d=img.data,{cx,cy,R}=P,rot=t*.012;
    const y0=Math.max(0,cy-R),x0=Math.max(0,cx-R),x1=Math.min(W,cx+R+2);
    for(let y=y0;y<H;y++)for(let x=x0;x<x1;x++){
      const nx=(x-cx)/R,ny=(y-cy)/R,q=nx*nx+ny*ny,k=(y*W+x)*4,bay=BAYER[(y&3)*4+(x&3)];
      if(q>1){ // Atmosphäre als dünner Saum auf der Tagseite
        const rr=Math.sqrt(q);if(rr<1+3/R){const lit=(nx*L[0]+ny*L[1]);if(lit>.1){const a=(1-(rr-1)*R/3)*Math.min(1,lit*1.4);if(a>bay){d[k]=Math.max(d[k],70);d[k+1]=Math.max(d[k+1],180);d[k+2]=Math.max(d[k+2],205)}}}
        continue}
      const nz=Math.sqrt(1-q);
      let lon=Math.atan2(nx,nz)+rot,lat=Math.asin(ny);
      const u=((lon/(2*Math.PI))%1+1)%1,v=lat/Math.PI+.5;
      const ti=((v*TH)|0)*TW+((u*TW)|0),tc=((v*TH)|0)*TW+((((u+t*.004)%1)*TW)|0);
      let kind=land[ti]>.56?'land':'sea';if(Math.abs(lat)>1.3-land[ti]*.2)kind='ice';
      if(cloud[tc]>.66)kind='cloud';
      let lum=Math.max(0,nx*L[0]+ny*L[1]+nz*L[2]);
      lum=lum*.85+.02+Math.pow(1-nz,2)*.35*Math.max(0,nx*L[0]+ny*L[1]);  // Randaufhellung zur Lichtseite
      const lev=Math.max(0,Math.min(4,Math.floor(lum*4.6+bay-.35)));
      const c=SURF[kind][lev];d[k]=c[0];d[k+1]=c[1];d[k+2]=c[2];
    }
  }

  function station(ctx,t){
    const sx=LOX,sy=LOY,f=(c,x,y,w,h)=>{ctx.fillStyle=c;ctx.fillRect(sx+x,sy+y,w,h)};
    // Ringbruchstück hinten (oben links)
    ring(ctx,sx+78,sy+35,34,200,318,t,false);
    // Gittermast mit Sonnensegeln
    f('#3e4a58',0,33,62,3);f('#7a8794',0,33,62,1);
    for(let i=2;i<60;i+=4){f('#56616e',i,31,1,1);f('#56616e',i+2,37,1,1)}
    f('#0b0e13',0,32,2,1);f('#0b0e13',1,36,2,1);f('#56616e',-2,34,2,1);   // abgerissenes Ende
    // Segel oben
    for(let i=0;i<4;i++){f('#0b0e13',8+i*12,12,11,19);f('#174552',9+i*12,13,9,17);for(let j=0;j<4;j++)f('#227f92',9+i*12,14+j*4,9,1);f('#2c6f7a',13+i*12,13,1,17)}
    f('#7a8794',8,11,48,1);f('#56616e',31,30,2,3);
    // Segel unten, verbogen und angerissen
    for(let i=0;i<3;i++){const ox=10+i*12,oy=39+i*2;f('#0b0e13',ox,oy,11,15-i*3);f('#174552',ox+1,oy+1,9,13-i*3);for(let j=0;j<3-i;j++)f('#227f92',ox+1,oy+2+j*4,9,1)}
    f('#0b0e13',36,44,4,5);f('#56616e',22,38,2,2);
    // Hauptmodul
    f('#0b0e13',59,20,40,30);f('#56616e',60,21,38,28);f('#9aa6b2',60,21,38,2);f('#7a8794',60,23,38,1);
    f('#2c343e',60,45,38,4);f('#2c6f7a',60,48,38,1);
    for(let i=66;i<98;i+=6)f('#3e4a58',i,23,1,22);
    for(let i=0;i<8;i++){const on=((t*1.3+i*.71)%5)>(i%3===0?3.2:.6);f(on?'#ffb000':'#2c343e',62+i*4,29,2,2)}
    for(let i=0;i<6;i++){const on=((t*.9+i*1.3)%7)>2;f(on?'#ffe066':'#2c343e',64+i*5,37,1,1)}
    // Einschlag mit austretendem Gas
    f('#0b0e13',83,39,8,7);f('#0b0e13',85,38,4,1);f('#0b0e13',82,41,1,3);f('#7a2a1a',86,41,2,2);
    // Antenne und Schüssel
    f('#7a8794',70,13,1,8);f('#9aa6b2',66,11,9,2);f('#56616e',67,13,7,1);f('#0b0e13',70,10,1,1);
    // zweites Modul, Rettungskapsel
    f('#0b0e13',98,27,26,18);f('#3e4a58',99,28,24,16);f('#7a8794',99,28,24,1);f('#2c343e',99,41,24,3);
    f('#0b0e13',123,31,12,10);f('#d7dde3',124,32,10,8);f('#eef3f6',125,32,6,1);f('#9aa6b2',124,38,10,2);f('#5fd3e6',130,34,3,2);
    if(((t*1.1)%2)<1)f('#ffb000',134,35,1,1);
    // Ringbruchstück vorn (unten rechts)
    ring(ctx,sx+78,sy+35,34,18,74,t,true);
    // Notsignal oben am Hauptmodul (Lichthof kommt nach dem Drehen, siehe beacon)
    const on=(t%1.4)<.55;
    f(on?'#ff4d3d':'#5a1c18',94,18,2,2);f('#56616e',94,20,2,1);
  }
  function ring(ctx,cx,cy,R,a0,a1,t,front){
    for(let y=-R-3;y<=R+3;y++)for(let x=-R-3;x<=R+3;x++){
      const d=Math.hypot(x,y*1.9);if(d<R-2||d>R+2)continue;     // perspektivisch gestaucht
      let a=Math.atan2(y*1.9,x)*180/Math.PI;if(a<0)a+=360;if(a<a0||a>a1)continue;
      const edge=d>R+1?'#7a8794':d<R-1?'#2c343e':'#3e4a58';
      ctx.fillStyle=edge;ctx.fillRect(cx+x,cy+y,1,1);
      if(Math.abs(d-R)<.5&&((Math.round(a)%9)===0)&&(((t*.7+a)%11)>3)){ctx.fillStyle='#ffb000';ctx.fillRect(cx+x,cy+y,1,1)}
    }
    // gezackte Bruchkanten
    for(const a of[a0,a1]){const rad=a*Math.PI/180,x=Math.round(Math.cos(rad)*R),y=Math.round(Math.sin(rad)*R/1.9);ctx.fillStyle='#0b0e13';ctx.fillRect(cx+x-1,cy+y-1,2,3)}
    if(!front)return;
  }

  /* Scale2x (EPX): verdoppelt Pixel-Art und rundet Treppen, damit gedrehte dünne Linien nicht zerfasern */
  function scale2x(src,w,h){
    const out=new Uint32Array(w*h*4),W2=w*2;
    for(let y=0;y<h;y++)for(let x=0;x<w;x++){
      const P=src[y*w+x],A=y>0?src[(y-1)*w+x]:P,B=x<w-1?src[y*w+x+1]:P,C=x>0?src[y*w+x-1]:P,D=y<h-1?src[(y+1)*w+x]:P;
      let e0=P,e1=P,e2=P,e3=P;
      if(C===A&&C!==D&&A!==B)e0=A;if(A===B&&A!==C&&B!==D)e1=B;if(D===C&&D!==B&&C!==A)e2=C;if(B===D&&B!==A&&D!==C)e3=D;
      const o=(y*2)*W2+x*2;out[o]=e0;out[o+1]=e1;out[o+W2]=e2;out[o+W2+1]=e3;
    }
    return out;
  }
  function stationRotated(t){
    // Ebene höchstens 10-mal pro Sekunde neu zeichnen und hochskalieren (Lichter blinken trotzdem flüssig genug)
    if(!up||Math.abs(t-lastLayer)>.1){
      lastLayer=t;lctx.clearRect(0,0,LW,LH);station(lctx,t);
      const raw=new Uint32Array(lctx.getImageData(0,0,LW,LH).data.buffer.slice(0));
      up=scale2x(scale2x(raw,LW,LH),LW*2,LH*2);upW=LW*4;upH=LH*4;
    }
    const d=new Uint32Array(img.data.buffer);
    // Rahmen der gedrehten Ebene in der Szene
    const cs=[[0,0],[LW,0],[0,LH],[LW,LH]].map(([x,y])=>toScene(x-LOX,y-LOY));
    const x0=Math.max(0,Math.floor(Math.min(...cs.map(c=>c.x)))),x1=Math.min(W,Math.ceil(Math.max(...cs.map(c=>c.x))));
    const y0=Math.max(0,Math.floor(Math.min(...cs.map(c=>c.y)))),y1=Math.min(H,Math.ceil(Math.max(...cs.map(c=>c.y))));
    for(let y=y0;y<y1;y++)for(let x=x0;x<x1;x++){
      const vx=x+.5-POS.x,vy=y+.5-POS.y;
      const lx=PIV.x+LOX+vx*COS+vy*SIN,ly=PIV.y+LOY-vx*SIN+vy*COS;   // zurückgedreht in Ebenenkoordinaten
      const ux=Math.floor(lx*4),uy=Math.floor(ly*4);
      if(ux<0||uy<0||ux>=upW||uy>=upH)continue;
      const c=up[uy*upW+ux];if((c>>>24)<128)continue;
      d[y*W+x]=c|0xff000000;
    }
  }
  function beacon(ctx,t){
    if((t%1.4)>=.55)return;
    const b=toScene(95,19),g=ctx.createRadialGradient(b.x,b.y,0,b.x,b.y,12);
    g.addColorStop(0,'rgba(255,77,61,.55)');g.addColorStop(1,'rgba(255,77,61,0)');ctx.fillStyle=g;ctx.fillRect(b.x-12,b.y-12,24,24);
  }

  function overlays(ctx,t){
    // Gas aus dem Einschlag
    const h=toScene(87,45);
    for(let k=0;k<14;k++){const age=((t*.55)+k/14)%1,sp=(k*37%11)/11-.5;
      // Ausströmrichtung (26,14) und Streuung mitdrehen
      const ax=age*26+sp*age*10,ay=age*14+sp*age*16;
      const x=Math.round(h.x+ax*COS-ay*SIN),y=Math.round(h.y+ax*SIN+ay*COS);
      ctx.fillStyle=`rgba(199,208,216,${(1-age)*.7})`;ctx.fillRect(x,y,age>.5?2:1,1)}
    // Trümmer treiben um die Station
    const bx=POS.x-130,by=0,bw=210,bh=H*.85;
    for(const d of debris){
      const x=Math.round(bx+(((d.x*bw+d.vx*t*6)%bw)+bw)%bw),y=Math.round(by+(((d.y*bh+d.vy*t*6)%bh)+bh)%bh);
      const sh=SHAPES[d.s],rot=Math.floor(t*d.rot)%4;ctx.fillStyle=d.col;
      for(const[a,b]of sh){const[px,py]=rot===0?[a,b]:rot===1?[-b,a]:rot===2?[-a,-b]:[b,-a];ctx.fillRect(x+px,y+py,1,1)}
    }
    // Sternschnuppe etwa alle 9 Sekunden, links oben
    const st=t%9;if(st<.7){const p=st/.7,x0=W*.05+p*W*.28,y0=H*.08+p*H*.22;
      for(let i=0;i<10;i++){ctx.fillStyle=`rgba(230,240,245,${(1-i/10)*(1-p)})`;ctx.fillRect(Math.round(x0-i*1.6),Math.round(y0-i*.8),1,1)}}
  }

  return{
    W,H,
    draw(ctx,t){
      background(t);planet(t);stationRotated(t);ctx.putImageData(img,0,0);
      beacon(ctx,t);overlays(ctx,t);
    },
  };
}
