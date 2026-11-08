// Titel- und Endbildschirm: Klassenwahl, Seed-Vorschau, Bestenlisten, Eintragen.
import {RW,RH,ROOMS,WALL,FLOOR,BLOCK,DOOR,CLS,UNL,UNLD} from '../core/config.js';
import {normSeed} from '../core/rng.js';
import {genRoom} from '../core/roomgen.js';
import {loadScores,lp,loadName,storeName} from '../core/storage.js';
import {S,setScreen,setSel} from '../core/game.js';
import {on} from '../core/bus.js';
import {iconURL,playerSpr} from '../render/sprites.js';

const $=id=>document.getElementById(id);

/* Datum eines Eintrags: kurz (07.11.26), Uhrzeit beim Darüberfahren */
function dateSpan(v){
  const d=v?new Date(v):null;if(!d||isNaN(d))return'<span class="dt"></span>';
  const short=d.toLocaleDateString('de-DE',{day:'2-digit',month:'2-digit',year:'2-digit'});
  const long=d.toLocaleString('de-DE',{dateStyle:'medium',timeStyle:'short'});
  return`<time class="dt" datetime="${d.toISOString()}" title="${long} Uhr">${short}</time>`;
}

function renderScores(el,hl){
  const list=loadScores();el.innerHTML='';
  if(!list.length){const li=document.createElement('li');li.className='none';li.textContent='Noch keine Einträge. Dein erster Run setzt die Marke.';el.append(li);return}
  list.forEach((s,i)=>{const li=document.createElement('li');if(hl&&s.id===hl)li.className='new';
    li.innerHTML=`<span class="rk">${i+1}.</span><span class="sc">${s.score.toLocaleString('de-DE')}</span><span>${CLS[s.cls]?CLS[s.cls].n:s.cls}</span><span class="sd">${s.seed}</span><span class="rs${s.win?' win':''}">${s.win?'entkommen':'Raum '+s.room}</span>${dateSpan(s.date||s.id)}`;el.append(li)});
}
/* Gemeinsame Bestenliste über /api/scores (nur auf der Vercel-Seite erreichbar) */
const API='/api/scores';let sending=false;
const esc=t=>String(t).replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
async function fetchGlobal(){
  try{const r=await fetch(API,{headers:{accept:'application/json'},cache:'no-store'});if(!r.ok)return null;const j=await r.json();return Array.isArray(j.scores)?j.scores:null}catch(e){return null}
}
function renderGlobal(el,list,hl){
  const note=t=>{el.innerHTML='';const li=document.createElement('li');li.className='none';li.textContent=t;el.append(li)};
  if(list==='loading')return note('Lade Bestenliste …');
  if(list===null)return note('Die gemeinsame Bestenliste ist hier gerade nicht erreichbar.');
  if(!list.length)return note('Noch niemand eingetragen. Der erste Platz ist frei.');
  el.innerHTML=list.slice(0,10).map((s,i)=>`<li${hl&&s.id===hl?' class="new"':''}><span class="rk">${i+1}.</span><span class="sc">${Number(s.score).toLocaleString('de-DE')}</span><span class="nm">${esc(s.name)}</span><span class="sd">${CLS[s.cls]?CLS[s.cls].n:''} · ${esc(s.seed)}</span><span class="rs${s.win?' win':''}">${s.win?'entkommen':'Raum '+Number(s.room)}</span>${dateSpan(s.date)}</li>`).join('');
}
function loadGlobal(el,hl){renderGlobal(el,'loading');fetchGlobal().then(l=>renderGlobal(el,l,hl))}
function sendMsg(t,k){const m=$('sendMsg');m.textContent=t;m.className='hint'+(k?' '+k:'')}
async function sendScore(){
  const e=S.lastEntry;if(!e||e.quit||e.sent||sending)return;
  const name=$('nameIn').value.replace(/\s+/g,' ').trim();
  if(!name){sendMsg('Bitte gib einen Namen ein.','warn');$('nameIn').focus();return}
  storeName(name);
  sending=true;$('sendBtn').disabled=true;sendMsg('Wird eingetragen …');
  try{
    const r=await fetch(API,{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({name,seed:e.seed,cls:e.cls,win:e.win,room:e.room,cleared:e.cleared,rounds:e.rounds,kills:e.kills,lvl:e.lvl,xp:e.xp})});
    const j=await r.json().catch(()=>({}));
    if(!r.ok){const x=new Error(j.error||'Der Server antwortet nicht');x.server=1;throw x}
    e.sent=true;e.gid=j.id;
    sendMsg(`Eingetragen als „${name}“: Platz ${j.rank} von ${j.total}.`,'good');
    $('nameIn').disabled=true;$('sendBtn').textContent='Eingetragen';
    renderGlobal($('gsEnd'),j.scores||[],j.id);
  }catch(err){
    sendMsg(`Eintragen hat nicht geklappt: ${String(err&&err.server?err.message:'keine Verbindung zum Server').replace(/\.$/,'')}.`,'warn');$('sendBtn').disabled=false;
  }
  sending=false;
}
function renderEnd(){
  const e=S.lastEntry;if(!e)return;$('scrEnd').classList.toggle('won',e.win);$('scrEnd').classList.toggle('quit',!e.win&&!!e.quit);
  $('endEyebrow').textContent=e.win?'Rettungskapsel gestartet':e.quit?'Rückzug angeordnet':'Signal verloren';
  $('endTitle').textContent=e.win?'Entkommen':e.quit?'Abgebrochen in Raum '+e.room:'Gefallen in Raum '+e.room;
  $('endText').textContent=e.win?`Als ${CLS[e.cls].n} hast du die Brutmutter getötet und die IKARUS-7 lebend verlassen.`:e.quit?`Du hast den Einsatz als ${CLS[e.cls].n} abgebrochen. Abgebrochene Runs kommen nicht in die Bestenliste.`:`${e.cause?'Getötet durch: '+e.cause+'. ':''}Die Bergungsakte für ${CLS[e.cls].n} wird geschlossen.`;
  const items=[['Punkte',e.score.toLocaleString('de-DE'),1],['Raum',`${e.room}/${ROOMS}`],['Stufe',e.lvl],['Abschüsse',e.kills],['Runden',e.rounds],['Seed',e.seed]];
  $('endStats').innerHTML=items.map(([a,b,big])=>`<div${big?' class="big"':''}><dt>${a}</dt><dd>${b}</dd></div>`).join('');
  $('shareTxt').value=`Wrack Ikarus · Seed ${e.seed} · ${CLS[e.cls].n}: ${e.score.toLocaleString('de-DE')} Punkte (${e.win?'entkommen':(e.quit?'abgebrochen':'gestorben')+' in Raum '+e.room+'/'+ROOMS}). Schlägst du das?`;
  renderScores($('hsEnd'),e.id);
  $('submitBox').hidden=!!e.quit;
  const nm=loadName();
  const ni=$('nameIn');if(!e.sent)ni.value=nm;ni.disabled=!!e.sent;
  $('sendBtn').disabled=!!e.sent;$('sendBtn').textContent=e.sent?'Eingetragen':'Eintragen';
  if(!e.sent)sendMsg('Trag dich ein, damit alle deinen Run sehen.');
  loadGlobal($('gsEnd'),e.gid);
}
function showScreen(s){
  setScreen(s);
  $('scrTitle').hidden=s!=='title';$('scrGame').hidden=s!=='game';$('scrEnd').hidden=s!=='end';
  $('quitBtn').hidden=s!=='game';$('quitBtn').textContent='Run abbrechen';$('quitBtn').classList.remove('warn');
  if(s==='title'){renderClasses();renderScores($('hsTitle'));loadGlobal($('gsTitle'));drawPreview();$('topInfo').textContent='Bergungseinsatz · Station IKARUS-7'}
  if(s==='game')window.scrollTo(0,0);
  if(s==='end'){renderEnd();$('topInfo').textContent='Einsatzbericht';window.scrollTo(0,0)}
}
function lpLine(k){
  const l=lp(k),nx=UNL.findIndex(t=>l<t);
  return`<span class="lp">LP ${l} · ${nx<0?'alles freigeschaltet':`bei ${UNL[nx]} LP: ${UNLD[k][nx]}`}${UNLD[k].filter((_,i)=>l>=UNL[i]).map(t=>`<br>✓ ${t}`).join('')}</span>`;
}
function renderClasses(){
  const box=$('classes');box.innerHTML='';
  Object.entries(CLS).forEach(([k,c])=>{
    const b=document.createElement('button');b.className='cls';b.setAttribute('aria-pressed',k===S.sel?'true':'false');
    b.innerHTML=`<img alt="" src="${iconURL(playerSpr(k),'cls_'+k,48)}"><span class="nm">${c.n}</span><span class="st">TP ${c.hp} · Angriff ${c.atk} · Panzerung ${c.def} · Bewegung ${c.mp}</span><span class="ab"><b>${c.ab}</b> ${c.abd}</span><span class="gear">${c.gear}</span>${lpLine(k)}`;
    b.onclick=()=>{setSel(k);renderClasses()};box.append(b);
  });
}
function drawPreview(){
  const x=$('pv').getContext('2d');const s=normSeed($('seedIn').value);
  x.fillStyle='#05070a';x.fillRect(0,0,68,52);
  if(!s){$('pvCap').textContent='Gib einen Seed ein oder würfle einen.';return}
  const d=genRoom(s,1,'','L');
  for(let i=0;i<RW*RH;i++){const t=d.map[i],px=(i%RW)*4,py=((i/RW)|0)*4;
    x.fillStyle=t===WALL?'#2d3743':t===BLOCK?'#6b5a3a':t===DOOR?'#ffb000':'#1d2631';x.fillRect(px,py,4,4);
    if(t===FLOOR){x.fillStyle='#141b23';x.fillRect(px+3,py,1,4);x.fillRect(px,py+3,4,1)}}
  x.fillStyle='#5fd3e6';x.fillRect(d.start.x*4,d.start.y*4,4,4);
  $('pvCap').textContent=`Raum 1, ${d.name}. Blau: du, Braun: Deckung, Gelb: Türen. Gegner siehst du erst drinnen.`;
}

on('screen',showScreen);

export {showScreen,renderClasses,drawPreview,sendScore};
