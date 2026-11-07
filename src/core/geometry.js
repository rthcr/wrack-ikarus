// Geometrie, Sichtlinien und Schrittprüfung.
// Aus der klassischen Version übernommen, Inhalt unverändert.

import {RW,RH,FLOOR} from './config.js';

const solidT=t=>t!==FLOOR;
const cheb=(a,b)=>Math.max(Math.abs(a.x-b.x),Math.abs(a.y-b.y));
function line(x0,y0,x1,y1){const pts=[];let dx=Math.abs(x1-x0),dy=-Math.abs(y1-y0),sx=x0<x1?1:-1,sy=y0<y1?1:-1,err=dx+dy;for(;;){pts.push([x0,y0]);if(x0===x1&&y0===y1)break;const e2=2*err;if(e2>=dy){err+=dy;x0+=sx}if(e2<=dx){err+=dx;y0+=sy}}return pts}
/* Sichtlinie: kein Zwischenfeld darf blockieren, und diagonal zwischen zwei Hindernissen hindurch gibt es keine Sicht. */
function losClear(map,ax,ay,bx,by){
  const pts=line(ax,ay,bx,by);
  for(let k=1;k<pts.length;k++){
    const[x,y]=pts[k],[px,py]=pts[k-1];
    if(x!==px&&y!==py&&solidT(map[px+y*RW])&&solidT(map[x+py*RW]))return false;
    if(k<pts.length-1&&solidT(map[x+y*RW]))return false;
  }
  return true;
}
/* Symmetrisch: wer dich sieht, den siehst du auch. */
const losMap=(map,a,b)=>losClear(map,a.x,a.y,b.x,b.y)||losClear(map,b.x,b.y,a.x,a.y);
function canStep(map,ax,ay,bx,by){
  if(bx<0||by<0||bx>=RW||by>=RH)return false;
  if(map[bx+by*RW]!==FLOOR)return false;
  if(ax!==bx&&ay!==by&&solidT(map[ax+by*RW])&&solidT(map[bx+ay*RW]))return false;
  return true;
}

export {solidT,cheb,line,losClear,losMap,canStep};
