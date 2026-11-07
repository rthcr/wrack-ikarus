// Zufall: deterministische Generatoren für Seeds.
// Aus der klassischen Version übernommen, Inhalt unverändert.

import {ALPH} from './config.js';

function h32(s){let h=2166136261>>>0;for(let i=0;i<s.length;i++){h^=s.charCodeAt(i);h=Math.imul(h,16777619)}return h>>>0}
function makeRng(seed){let a=seed>>>0;return()=>{a=(a+0x6D2B79F5)|0;let t=Math.imul(a^a>>>15,1|a);t=t+Math.imul(t^t>>>7,61|t)^t;return((t^t>>>14)>>>0)/4294967296}}
function wpick(tab,r){let s=0;for(const k in tab)s+=tab[k];let v=r()*s;for(const k in tab){v-=tab[k];if(v<0)return k}return Object.keys(tab)[0]}
const normSeed=s=>(s||'').toUpperCase().replace(/[^A-Z0-9]/g,'').slice(0,10);
function randomSeed(){let s='';for(let i=0;i<6;i++)s+=ALPH[Math.floor(Math.random()*ALPH.length)];return s}

export {h32,makeRng,wpick,normSeed,randomSeed};
