// Nachspielen eines Runs aus seiner Aufzeichnung (G.rec), z. B. auf dem Server vor dem Eintragen in die Bestenliste.
// Gleicher Seed + gleiche Eingaben ergeben denselben Run (siehe Determinismus in CLAUDE.md). Kein DOM.
//
// Ablauf: Run mit Seed, Klasse und Start-LP beginnen, dann jede Eingabe genau in der Lage abschicken,
// in der sie im Original kam (gleiche Rundenzahl, gleiche Phase, Spiel wartet auf Eingabe).
// Ereignis R = Seite wurde neu geladen: Dann wird der Spielstand genommen, der im Original zuletzt
// gespeichert war (erkannt am Prüfwert), und wie beim echten Neuladen fortgesetzt.
//
// Das Spielmodul ist ein Singleton: Es darf immer nur ein Nachspielen gleichzeitig laufen (siehe api/scores.js).
import * as game from './game.js';
import {CLS} from './config.js';

const RUNKEY='wrack-ikarus-run-v3',LPKEY='wrack-ikarus-lp';
const CODES='scfabudgpex';
const MAX_EVENTS=30000;

/* Form der Aufzeichnung prüfen, bevor irgendetwas ausgeführt wird */
function checkRec(rec){
  if(!Array.isArray(rec)||rec.length>MAX_EVENTS)return false;
  for(const ev of rec){
    if(!Array.isArray(ev)||ev.length<3||ev.length>6)return false;
    if(ev[0]==='R'){if(typeof ev[1]!=='string'||ev[1].length>40||!Number.isFinite(ev[2]))return false;continue}
    if(typeof ev[0]!=='string'||ev[0].length!==1||!CODES.includes(ev[0]))return false;
    if(!Number.isInteger(ev[1])||ev[1]<0||(ev[2]!=='p'&&ev[2]!=='x'))return false;
    for(let i=3;i<ev.length;i++)if(!Number.isInteger(ev[i])||Math.abs(ev[i])>99)return false;
  }
  return true;
}

/* Wartet, bis cond() stimmt: erst Mikroschritte (laufende Abläufe wie Laufweg oder Gegnerzug),
   dann auch Zeitgeber (z. B. automatisches Zugende). Gibt false zurück, wenn es nie stimmt. */
async function until(cond,budget){
  for(;;){
    // 64 Mikroschritte reichen, damit Laufweg und Gegnerzug weiterlaufen; danach die Zeitgeber zum Zug kommen lassen.
    // (Wartet die Eingabe auf das automatische Zugende, käme es sonst erst nach sehr vielen leeren Schritten.)
    for(let i=0;i<64;i++){if(cond())return true;if(--budget.n<0)return false;await null}
    if(Date.now()>budget.end)return cond();
    await new Promise(r=>setTimeout(r,0));
  }
}

/**
 * @param {{seed:string,cls:string,lp0:number,day:string|null,rec:any[]}} run
 * @returns {Promise<{ok:true,entry:object}|{ok:false,reason:string}>}
 */
export async function replayRun(run){
  const {seed,cls,day}=run;const lp0=Math.max(0,Math.min(1e7,Math.floor(Number(run.lp0)||0)));
  if(typeof seed!=='string'||!/^[A-Z0-9]{1,10}$/.test(seed)||!CLS[cls])return{ok:false,reason:'Seed oder Klasse ungültig'};
  if(!checkRec(run.rec))return{ok:false,reason:'Aufzeichnung ungültig'};
  const rec=run.rec;

  // Browserspeicher nachbilden: LP der Klasse wie beim Start; gespeicherte Stände seit der letzten Eingabe merken
  const mem=new Map([[LPKEY,JSON.stringify({[cls]:lp0})]]);
  let saves=[],lastSave=null;const hashed=new Map();
  const prevLS=globalThis.localStorage;
  globalThis.localStorage={
    getItem:k=>mem.has(k)?mem.get(k):null,
    setItem(k,v){v=String(v);mem.set(k,v);if(k===RUNKEY)saves.push(v)},
    removeItem:k=>mem.delete(k),
  };
  const hasReload=rec.some(ev=>ev[0]==='R');
  const prevTiming={scale:game.timing.scale,save:game.timing.save};
  game.timing.scale=0;game.timing.save=hasReload;   // ohne Neuladen muss nichts gespeichert werden
  const budget={n:2e7,end:Date.now()+8000};   // Obergrenze für Rechenschritte und Zeit (8 s)
  try{
    game.startRun(seed,cls,{day:day||null});
    const S=game.S;
    for(let i=0;i<rec.length;i++){
      const ev=rec[i];
      if(ev[0]==='R'){
        // Den Stand finden, der im Original beim Neuladen gespeichert war
        let found=null;
        // Prüfwerte nur einmal je gespeichertem Stand berechnen
        const ok=await until(()=>{const c=lastSave?[lastSave,...saves]:saves;for(const s of c){if(!hashed.has(s))hashed.set(s,game.runHash(JSON.parse(s).G));if(hashed.get(s)===ev[1]){found=s;return true}}return false},budget);
        if(!ok)return{ok:false,reason:`Neuladen #${i}: gespeicherter Stand nicht gefunden`};
        mem.set(LPKEY,JSON.stringify({[cls]:ev[2]}));
        if(!game.restore(JSON.parse(found)))return{ok:false,reason:`Neuladen #${i}: Stand ungültig`};
      }else{
        const ready=()=>{const G=S.G;return G&&!G.over&&!S.busy&&G.rounds===ev[1]&&(G.phase==='explore'?'x':'p')===ev[2]};
        if(!await until(ready,budget))return{ok:false,reason:`Eingabe #${i} (${ev[0]}) passt nicht zum Spielverlauf (Runde ${S.G&&S.G.rounds}, erwartet ${ev[1]})`};
        lastSave=saves.length?saves[saves.length-1]:lastSave;saves=[];hashed.clear();
        game.ACTIONS[ev[0]](...ev.slice(3));
      }
    }
    // Nach der letzten Eingabe muss der Run von selbst enden (Tod im Gegnerzug oder Flucht mit der Kapsel)
    if(!await until(()=>S.G&&S.G.over,budget))return{ok:false,reason:'Run endet nicht'};
    const e=S.lastEntry;
    if(!e||e.quit)return{ok:false,reason:'Run abgebrochen'};
    return{ok:true,spins:2e7-budget.n,entry:{seed:e.seed,cls:e.cls,day:e.day,room:e.room,win:e.win,cleared:e.cleared,rounds:e.rounds,kills:e.kills,lvl:e.lvl,xp:e.xp,score:e.score}};
  }catch(err){
    return{ok:false,reason:'Fehler beim Nachspielen: '+(err&&err.message||err)};
  }finally{
    game.timing.scale=prevTiming.scale;game.timing.save=prevTiming.save;
    globalThis.localStorage=prevLS;
  }
}
