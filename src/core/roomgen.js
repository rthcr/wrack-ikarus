// Raumgenerator: baut aus Seed, Raumnummer und Türweg immer denselben Raum.
// Aus der klassischen Version übernommen, Inhalt unverändert.

import {RW,RH,ROOMS,WALL,FLOOR,BLOCK,DOOR,POD,D8,OPP,ROOMNAMES,RTABLE,ELITE,SHAPES,tierOf,bossRoomName} from './config.js';
import {h32,makeRng,wpick} from './rng.js';
import {canStep} from './geometry.js';

const sideMid=s=>(s==='L'||s==='R')?(RH>>1):(RW>>1);
const sideRange=s=>(s==='L'||s==='R')?[2,RH-3]:[2,RW-3];
function sideTile(s,pos){switch(s){case'L':return{x:0,y:pos,ix:1,iy:pos};case'R':return{x:RW-1,y:pos,ix:RW-2,iy:pos};case'T':return{x:pos,y:0,ix:pos,iy:1};default:return{x:pos,y:RH-1,ix:pos,iy:RH-2}}}
function toward(s,depth,off){const m=sideMid(s);switch(s){case'L':return{x:depth,y:m+off};case'R':return{x:RW-1-depth,y:m+off};case'T':return{x:m+off,y:depth};default:return{x:m+off,y:RH-1-depth}}}
function bfsGrid(map,sx,sy,blocked){
  const d=new Int16Array(RW*RH).fill(-1);d[sx+sy*RW]=0;const q=[sx+sy*RW];let qi=0;
  while(qi<q.length){const i=q[qi++],x=i%RW,y=(i/RW)|0;
    for(const[dx,dy]of D8){const nx=x+dx,ny=y+dy;if(!canStep(map,x,y,nx,ny))continue;const j=nx+ny*RW;if(d[j]>=0)continue;if(blocked&&blocked(nx,ny))continue;d[j]=d[i]+1;q.push(j)}}
  return d;
}
function genRoom(seed,idx,path,entry){
  const r=makeRng(h32(seed+'#raum'+idx+'#'+path));
  const rr=(a,b)=>a+Math.floor(r()*(b-a+1));
  const pick=a=>a[Math.floor(r()*a.length)];
  const boss=idx===ROOMS,tier=tierOf(idx);
  const ent=sideTile(entry,sideMid(entry));
  const start={x:ent.ix,y:ent.iy};
  const opp=OPP[entry];
  const exits=[];
  if(!boss){
    const sides=['L','R','T','B'].filter(s=>s!==entry);
    for(let i=sides.length-1;i>0;i--){const j=Math.floor(r()*(i+1));[sides[i],sides[j]]=[sides[j],sides[i]]}
    const n=idx===ROOMS-1?1:(r()<.4?3:2);
    for(let k=0;k<n;k++){const s=sides[k];const[a,b]=sideRange(s);exits.push({side:s,pos:rr(a,b)})}
  }
  const pod=boss?sideTile(opp,sideMid(opp)):null;
  let map=null;
  for(let att=0;att<60;att++){
    map=new Array(RW*RH).fill(WALL);
    for(let y=1;y<RH-1;y++)for(let x=1;x<RW-1;x++)map[x+y*RW]=FLOOR;
    map[ent.x+ent.y*RW]=DOOR;
    const prot=new Set();
    for(const[dx,dy]of[[0,0],...D8])prot.add((start.x+dx)+(start.y+dy)*RW);
    exits.forEach(e=>{const t=sideTile(e.side,e.pos);map[t.x+t.y*RW]=DOOR;prot.add(t.ix+t.iy*RW)});
    if(pod){map[pod.x+pod.y*RW]=POD;prot.add(pod.ix+pod.iy*RW)}
    if(boss){
      [[5,-3],[5,3],[9,-2],[9,2]].forEach(([dd,o])=>{const t=toward(opp,dd,o);map[t.x+t.y*RW]=BLOCK});
    }else{
      const n=Math.max(2,rr(4,7)-(att>30?2:0));
      for(let k=0;k<n;k++){
        const sh=pick(SHAPES),x=rr(2,RW-5),y=rr(2,RH-5);
        const cells=sh.map(([a,b])=>[x+a,y+b]);
        if(cells.some(([cx,cy])=>prot.has(cx+cy*RW)||map[cx+cy*RW]!==FLOOR))continue;
        cells.forEach(([cx,cy])=>map[cx+cy*RW]=BLOCK);
      }
    }
    const d=bfsGrid(map,start.x,start.y);
    let ok=true;for(let i=0;i<RW*RH;i++)if(map[i]===FLOOR&&d[i]<0){ok=false;break}
    if(ok)break;
  }
  const deco=[];for(let i=0;i<RW*RH;i++)deco.push(Math.round(r()*1000)/1000);
  const dist=bfsGrid(map,start.x,start.y);
  const used=new Set([start.x+start.y*RW]);
  const free=[];for(let i=0;i<RW*RH;i++)if(map[i]===FLOOR&&dist[i]>=5)free.push(i);
  for(let i=free.length-1;i>0;i--){const j=Math.floor(r()*(i+1));[free[i],free[j]]=[free[j],free[i]]}
  const take=()=>{while(free.length){const i=free.pop();if(!used.has(i)){used.add(i);return{x:i%RW,y:(i/RW)|0}}}return null};
  const mons=[];let elite=false;
  if(boss){
    const q=toward(opp,3,0);mons.push({t:'queen',x:q.x,y:q.y});used.add(q.x+q.y*RW);
    [toward(opp,2,-4),toward(opp,2,4)].forEach(t=>{if(map[t.x+t.y*RW]===FLOOR&&!used.has(t.x+t.y*RW)){mons.push({t:'turret',x:t.x,y:t.y});used.add(t.x+t.y*RW)}});
    for(let k=0;k<2;k++){const p=take();if(p)mons.push({t:'larva',x:p.x,y:p.y})}
  }else{
    const n=tier===1?(idx===1?2:3):tier===2?rr(3,4):rr(4,5);
    for(let k=0;k<n;k++){const p=take();if(p)mons.push({t:wpick(RTABLE[tier],r),x:p.x,y:p.y})}
    if(idx>=2&&r()<.25){elite=true;const p=take();if(p)mons.push({t:ELITE[tier],x:p.x,y:p.y,elite:1})}
  }
  return{map,deco,start,mons,exits,entry,boss,elite,pod,name:boss?bossRoomName():pick(ROOMNAMES[tier])};
}

export {sideMid,sideRange,sideTile,toward,bfsGrid,genRoom};
