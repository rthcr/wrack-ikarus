// Sprache (Deutsch/Englisch) für Logik und Oberfläche. Kein DOM: Die Oberfläche (ui/lang.js) setzt die Sprache.
// Texte im Code: L('deutsch','english'). Datentabellen (Namen in config.js) bekommen über localize() Getter,
// die je nach Sprache den deutschen oder englischen Wert liefern; bestehender Code wie CLS.marine.n bleibt gleich.
let lang='de';
const LANGS=['de','en'];

function setLang(l){lang=LANGS.includes(l)?l:'de'}
const getLang=()=>lang;
const L=(de,en)=>lang==='en'?en:de;
/* Zahlen mit Tausenderpunkt bzw. -komma */
const nf=n=>Number(n).toLocaleString(lang==='en'?'en-US':'de-DE');
/* Für Datumsangaben: en-GB schreibt Tag/Monat wie im Deutschen, nur mit Schrägstrich */
const locale=()=>lang==='en'?'en-GB':'de-DE';

/* Ersetzt in target jedes Feld, das in en vorkommt, durch einen Getter (auch verschachtelt und in Arrays). */
function localize(target,en){
  for(const k of Object.keys(en)){
    const e=en[k],d=target[k];
    if(e!==null&&typeof e==='object'){localize(d,e);continue}
    Object.defineProperty(target,k,{get:()=>lang==='en'?e:d,enumerable:true,configurable:true});
  }
  return target;
}

export {LANGS,setLang,getLang,L,nf,locale,localize};
