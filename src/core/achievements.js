// Erfolge: kleine Ziele, die im Browser gespeichert werden (storage.js). Kein DOM.
// Geprüft wird am Ende eines Runs (finish in game.js) und beim Start eines Tagesruns (Serie).
// e: Eintrag des beendeten Runs samt Zählern e.st (siehe newStats in game.js), oder null.
// m: {wins: Klassen mit Flucht, streak: längste Serie beim Seed des Tages}
import {L} from './i18n.js';
import {CLS} from './config.js';
import {loadAch,storeAch,streak} from './storage.js';
import {dayKey} from './rng.js';

const FAST=80;   // Runden für „Blitzbergung“
const ACH=[
  {id:'room5',n:['Tief im Wrack','Deep in the wreck'],d:['Erreiche Raum 5.','Reach room 5.'],t:e=>!!e&&e.room>=5},
  {id:'win',n:['Entkommen','Escaped'],d:['Flieh mit der Rettungskapsel.','Escape with the pod.'],t:e=>!!e&&e.win},
  {id:'clean3',n:['Saubere Arbeit','Clean work'],d:['Sichere in einem Run 3 Räume, ohne Schaden zu nehmen.','Secure 3 rooms in one run without taking damage.'],t:e=>!!e&&e.st.clean>=3},
  {id:'lvl',n:['Veteran','Veteran'],d:['Erreiche in einem Run Stufe 6.','Reach level 6 in one run.'],t:e=>!!e&&e.lvl>=6},
  {id:'mine',n:['Fallensteller','Trapper'],d:['Erledige einen Gegner mit einer Annäherungsmine.','Kill an enemy with a proximity mine.'],t:e=>!!e&&e.st.mineK>=1},
  {id:'sentry',n:['Selbstschussanlage','Automated defense'],d:['Dein Geschütz erledigt in einem Run 5 Gegner.','Your sentry gun kills 5 enemies in one run.'],t:e=>!!e&&e.st.sentryK>=5},
  {id:'boss',n:['Unberührt','Untouched'],d:['Besiege die Brutmutter, ohne in ihrem Raum Schaden zu nehmen.','Defeat the Brood Mother without taking damage in her room.'],t:e=>!!e&&e.st.boss===1},
  {id:'noshot',n:['Kalter Lauf','Cold barrel'],d:['Entkomme, ohne einen einzigen Schuss abzugeben.','Escape without firing a single shot.'],t:e=>!!e&&e.win&&e.st.shots===0},
  {id:'noitem',n:['Mit leeren Taschen','Empty pockets'],d:['Entkomme, ohne einen Gegenstand zu benutzen (Ausrüsten zählt nicht).','Escape without using an item (equipping doesn’t count).'],t:e=>!!e&&e.win&&e.st.used===0},
  {id:'fast',n:['Blitzbergung','Lightning salvage'],d:[`Entkomme in höchstens ${FAST} Runden.`,`Escape in ${FAST} rounds or fewer.`],t:e=>!!e&&e.win&&e.rounds<=FAST},
  {id:'all',n:['Ganze Crew','Full crew'],d:['Entkomme mit jeder der vier Klassen.','Escape with each of the four classes.'],t:(e,m)=>Object.keys(CLS).every(k=>m.wins[k])},
  {id:'streak3',n:['Stammgast','Regular'],d:['Spiele den Seed des Tages an 3 Tagen in Folge.','Play the seed of the day 3 days in a row.'],t:(e,m)=>m.streak>=3},
  {id:'streak7',n:['Dauerdienst','On permanent duty'],d:['Spiele den Seed des Tages an 7 Tagen in Folge.','Play the seed of the day 7 days in a row.'],t:(e,m)=>m.streak>=7},
];
const achName=a=>L(...a.n),achDesc=a=>L(...a.d);
const achById=id=>ACH.find(a=>a.id===id);

/* Neue Erfolge vergeben und speichern. Gibt die Kürzel der neu erreichten zurück. */
function award(e){
  const a=loadAch();let changed=false;
  if(e&&e.win&&!a.wins[e.cls]){a.wins[e.cls]=1;changed=true}
  const m={wins:a.wins,streak:streak(dayKey()).best},neu=[];
  for(const x of ACH)if(!a.got[x.id]&&x.t(e,m)){a.got[x.id]=new Date().toISOString();neu.push(x.id)}
  if(changed||neu.length)storeAch(a);
  return neu;
}
/* Für die Anzeige: alle Erfolge mit Datum (oder null) */
const achList=()=>{const got=loadAch().got;return ACH.map(a=>({...a,at:got[a.id]||null}))};

export {ACH,award,achList,achName,achDesc,achById};
