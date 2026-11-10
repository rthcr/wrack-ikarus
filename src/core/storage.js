// Speicher im Browser: lokale Bestenliste, Lernpunkte (LP) pro Klasse, Name, Ton.
// Bestenliste und LP wie in der klassischen Version, gleiche Schlüssel: Fortschritt gilt in beiden Fassungen.

const SKEY='wrack-ikarus-bestenliste-v2';let memScores=[];
function loadScores(){try{const v=JSON.parse(localStorage.getItem(SKEY)||'null');if(Array.isArray(v))return v}catch(e){}return memScores.slice()}
function saveScore(e){const a=loadScores();a.push(e);a.sort((x,y)=>y.score-x.score);const top=a.slice(0,10);memScores=top;try{localStorage.setItem(SKEY,JSON.stringify(top))}catch(err){}return top}
const LKEY='wrack-ikarus-lp';let memLP={};
function loadLP(){try{const v=JSON.parse(localStorage.getItem(LKEY)||'null');if(v&&typeof v==='object')return v}catch(e){}return{...memLP}}
function addLP(cls,x){const a=loadLP();a[cls]=(a[cls]||0)+x;memLP=a;try{localStorage.setItem(LKEY,JSON.stringify(a))}catch(e){}return a[cls]}
const lp=cls=>loadLP()[cls]||0;

/* Laufender Run. Eigener Schlüssel, damit sich klassische und neue Version nicht gegenseitig Runs laden. */
const RKEY='wrack-ikarus-run-v4';
function loadRun(){try{return JSON.parse(localStorage.getItem(RKEY)||'null')}catch(e){return null}}
function storeRun(data){try{if(data)localStorage.setItem(RKEY,JSON.stringify(data));else localStorage.removeItem(RKEY)}catch(e){}}
const NKEY='wrack-ikarus-name';
function loadName(){try{return localStorage.getItem(NKEY)||''}catch(e){return''}}
function storeName(n){try{localStorage.setItem(NKEY,n)}catch(e){}}
const TKEY='wrack-ikarus-ton';
function loadSound(){try{return localStorage.getItem(TKEY)!=='0'}catch(e){return true}}
function storeSound(on){try{localStorage.setItem(TKEY,on?'1':'0')}catch(e){}}

const FKEY='wrack-ikarus-filter';
function loadFilter(){try{return localStorage.getItem(FKEY)!=='0'}catch(e){return true}}
function storeFilter(on){try{localStorage.setItem(FKEY,on?'1':'0')}catch(e){}}
/* Sprache: 'de' oder 'en'; null = noch nie gewählt (dann entscheidet die Browsersprache) */
const LANGKEY='wrack-ikarus-lang';
function loadLang(){try{const v=localStorage.getItem(LANGKEY);return v==='de'||v==='en'?v:null}catch(e){return null}}
function storeLang(l){try{localStorage.setItem(LANGKEY,l)}catch(e){}}

const MKEY='wrack-ikarus-musik';
function loadMusic(){try{return localStorage.getItem(MKEY)!=='0'}catch(e){return true}}
function storeMusic(on){try{localStorage.setItem(MKEY,on?'1':'0')}catch(e){}}

const VKEY='wrack-ikarus-lautstaerke';
function loadVolumes(){try{const v=JSON.parse(localStorage.getItem(VKEY)||'null');if(v&&typeof v==='object')return{sfx:+v.sfx||0,music:+v.music||0}}catch(e){}return{sfx:80,music:70}}
function storeVolumes(v){try{localStorage.setItem(VKEY,JSON.stringify(v))}catch(e){}}

/* Tutorial einmal geschafft? (Der Startbildschirm weist neue Spieler sonst darauf hin) */
const TUTKEY='wrack-ikarus-tutorial';
function loadTutorialDone(){try{return localStorage.getItem(TUTKEY)==='1'}catch(e){return false}}
function storeTutorialDone(){try{localStorage.setItem(TUTKEY,'1')}catch(e){}}
export {loadTutorialDone,storeTutorialDone,loadVolumes,storeVolumes,loadMusic,storeMusic,loadFilter,storeFilter,loadLang,storeLang,loadScores,saveScore,loadLP,addLP,lp,loadRun,storeRun,loadName,storeName,loadSound,storeSound};
