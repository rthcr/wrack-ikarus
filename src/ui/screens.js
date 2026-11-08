// Titel- und Endbildschirm: Klassenwahl, Seed-Vorschau, Bestenlisten, Eintragen.
import {RW,RH,ROOMS,WALL,FLOOR,BLOCK,DOOR,CLS,UNL,UNLD,causeName} from '../core/config.js';
import {L,nf,locale} from '../core/i18n.js';
import {normSeed} from '../core/rng.js';
import {genRoom} from '../core/roomgen.js';
import {loadScores,lp,loadName,storeName} from '../core/storage.js';
import {S,setScreen,setSel} from '../core/game.js';
import {on} from '../core/bus.js';
import {iconURL,playerSpr} from '../render/sprites.js';

const $=id=>document.getElementById(id);
const TOP_TITLE=()=>L('Bergungseinsatz · Station IKARUS-7','Salvage mission · Station IKARUS-7');
const TOP_END=()=>L('Einsatzbericht','Mission report');
/* LP = alle je mit der Klasse gesammelten EP; auf Englisch VP (veteran points) */
const LP=()=>L('LP','VP');
/* Fehlermeldungen des Servers kommen auf Deutsch; auf Englisch übersetzen */
const SERVER_EN={'Ungültige Daten.':'Invalid data.','Bitte gib einen Namen ein.':'Please enter a name.','Ungültiger Seed.':'Invalid seed.','Ungültige Klasse.':'Invalid class.','Ungültige Werte.':'Invalid values.',
  'Dieser Run ist nicht plausibel.':'This run is not plausible.','Die Datenbank ist nicht mit dem Projekt verbunden.':'The database is not connected to the project.',
  'Zu viele Einträge. Versuch es in einer Minute nochmal.':'Too many entries. Try again in a minute.','Die Bestenliste ist gerade nicht erreichbar.':'The leaderboard is unavailable right now.'};
const serverMsg=m=>m&&L(m,SERVER_EN[m]||'The server rejected the entry.');

/* Datum eines Eintrags: kurz (07.11.26), Uhrzeit beim Darüberfahren */
function dateSpan(v){
  const d=v?new Date(v):null;if(!d||isNaN(d))return'<span class="dt"></span>';
  const short=d.toLocaleDateString(locale(),{day:'2-digit',month:'2-digit',year:'2-digit'});
  const long=d.toLocaleString(locale(),{dateStyle:'medium',timeStyle:'short'});
  return`<time class="dt" datetime="${d.toISOString()}" title="${long}${L(' Uhr','')}">${short}</time>`;
}

function renderScores(el,hl){
  const list=loadScores();el.innerHTML='';
  if(!list.length){const li=document.createElement('li');li.className='none';li.textContent=L('Noch keine Einträge. Dein erster Run setzt die Marke.','No entries yet. Your first run sets the mark.');el.append(li);return}
  list.forEach((s,i)=>{const li=document.createElement('li');if(hl&&s.id===hl)li.className='new';
    li.innerHTML=`<span class="rk">${i+1}.</span><span class="sc">${nf(s.score)}</span><span>${CLS[s.cls]?CLS[s.cls].n:s.cls}</span><span class="sd">${s.seed}</span><span class="rs${s.win?' win':''}">${s.win?L('entkommen','escaped'):L('Raum ','Room ')+s.room}</span>${dateSpan(s.date||s.id)}`;el.append(li)});
}
/* Gemeinsame Bestenliste über /api/scores (nur auf der Vercel-Seite erreichbar) */
const API='/api/scores';let sending=false;
const esc=t=>String(t).replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
async function fetchGlobal(){
  try{const r=await fetch(API,{headers:{accept:'application/json'},cache:'no-store'});if(!r.ok)return null;const j=await r.json();return Array.isArray(j.scores)?j.scores:null}catch(e){return null}
}
const lastGlobal=new Map();   // zuletzt geladene Liste je Element, zum Neuzeichnen nach Sprachwechsel
function renderGlobal(el,list,hl){
  lastGlobal.set(el,[list,hl]);
  const note=t=>{el.innerHTML='';const li=document.createElement('li');li.className='none';li.textContent=t;el.append(li)};
  if(list==='loading')return note(L('Lade Bestenliste …','Loading leaderboard …'));
  if(list===null)return note(L('Die gemeinsame Bestenliste ist hier gerade nicht erreichbar.','The shared leaderboard can’t be reached from here right now.'));
  if(!list.length)return note(L('Noch niemand eingetragen. Der erste Platz ist frei.','Nobody on the board yet. First place is free.'));
  el.innerHTML=list.slice(0,10).map((s,i)=>`<li${hl&&s.id===hl?' class="new"':''}><span class="rk">${i+1}.</span><span class="sc">${nf(s.score)}</span><span class="nm">${esc(s.name)}</span><span class="sd">${CLS[s.cls]?CLS[s.cls].n:''} · ${esc(s.seed)}</span><span class="rs${s.win?' win':''}">${s.win?L('entkommen','escaped'):L('Raum ','Room ')+Number(s.room)}</span>${dateSpan(s.date)}</li>`).join('');
}
function loadGlobal(el,hl){renderGlobal(el,'loading');fetchGlobal().then(l=>renderGlobal(el,l,hl))}
function sendMsg(t,k){const m=$('sendMsg');m.textContent=t;m.className='hint'+(k?' '+k:'')}
async function sendScore(){
  const e=S.lastEntry;if(!e||e.quit||e.sent||sending)return;
  const name=$('nameIn').value.replace(/\s+/g,' ').trim();
  if(!name){sendMsg(L('Bitte gib einen Namen ein.','Please enter a name.'),'warn');$('nameIn').focus();return}
  storeName(name);
  sending=true;$('sendBtn').disabled=true;sendMsg(L('Wird eingetragen …','Submitting …'));
  try{
    const r=await fetch(API,{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({name,seed:e.seed,cls:e.cls,win:e.win,room:e.room,cleared:e.cleared,rounds:e.rounds,kills:e.kills,lvl:e.lvl,xp:e.xp})});
    const j=await r.json().catch(()=>({}));
    if(!r.ok){const x=new Error(serverMsg(j.error)||L('Der Server antwortet nicht','The server is not responding'));x.server=1;throw x}
    e.sent=true;e.gid=j.id;
    sendMsg(L(`Eingetragen als „${name}“: Platz ${j.rank} von ${j.total}.`,`Submitted as “${name}”: rank ${j.rank} of ${j.total}.`),'good');
    $('nameIn').disabled=true;$('sendBtn').textContent=L('Eingetragen','Submitted');
    renderGlobal($('gsEnd'),j.scores||[],j.id);
  }catch(err){
    sendMsg(L('Eintragen hat nicht geklappt: ','Submitting failed: ')+`${String(err&&err.server?err.message:L('keine Verbindung zum Server','no connection to the server')).replace(/\.$/,'')}.`,'warn');$('sendBtn').disabled=false;
  }
  sending=false;
}
function renderEnd(){
  const e=S.lastEntry;if(!e)return;$('scrEnd').classList.toggle('won',e.win);$('scrEnd').classList.toggle('quit',!e.win&&!!e.quit);
  const cn=CLS[e.cls].n,cause=causeName(e.cause);
  $('endEyebrow').textContent=e.win?L('Rettungskapsel gestartet','Escape pod launched'):e.quit?L('Rückzug angeordnet','Retreat ordered'):L('Signal verloren','Signal lost');
  $('endTitle').textContent=e.win?L('Entkommen','Escaped'):e.quit?L('Abgebrochen in Raum ','Abandoned in room ')+e.room:L('Gefallen in Raum ','Fell in room ')+e.room;
  $('endText').textContent=e.win?L(`Als ${cn} hast du die Brutmutter getötet und die IKARUS-7 lebend verlassen.`,`As the ${cn} you killed the Brood Mother and left the IKARUS-7 alive.`)
    :e.quit?L(`Du hast den Einsatz als ${cn} abgebrochen. Abgebrochene Runs kommen nicht in die Bestenliste.`,`You abandoned the mission as the ${cn}. Abandoned runs don’t go on the leaderboard.`)
    :L(`${cause?'Getötet durch: '+cause+'. ':''}Die Bergungsakte für ${cn} wird geschlossen.`,`${cause?'Killed by: '+cause+'. ':''}The salvage file for the ${cn} is closed.`);
  const items=[[L('Punkte','Score'),nf(e.score),1],[L('Raum','Room'),`${e.room}/${ROOMS}`],[L('Stufe','Level'),e.lvl],[L('Abschüsse','Kills'),e.kills],[L('Runden','Rounds'),e.rounds],['Seed',e.seed]];
  $('endStats').innerHTML=items.map(([a,b,big])=>`<div${big?' class="big"':''}><dt>${a}</dt><dd>${b}</dd></div>`).join('');
  $('shareTxt').value=L(`Wrack Ikarus · Seed ${e.seed} · ${cn}: ${nf(e.score)} Punkte (${e.win?'entkommen':(e.quit?'abgebrochen':'gestorben')+' in Raum '+e.room+'/'+ROOMS}). Schlägst du das?`,
    `Wrack Ikarus · Seed ${e.seed} · ${cn}: ${nf(e.score)} points (${e.win?'escaped':(e.quit?'abandoned':'died')+' in room '+e.room+'/'+ROOMS}). Can you beat that?`);
  renderScores($('hsEnd'),e.id);
  $('submitBox').hidden=!!e.quit;
  const nm=loadName();
  const ni=$('nameIn');if(!e.sent&&!ni.value)ni.value=nm;ni.disabled=!!e.sent;
  $('sendBtn').disabled=!!e.sent;$('sendBtn').textContent=e.sent?L('Eingetragen','Submitted'):L('Eintragen','Submit');
  if(!e.sent&&!sending)sendMsg(L('Trag dich ein, damit alle deinen Run sehen.','Submit your run so everyone can see it.'));
  loadGlobal($('gsEnd'),e.gid);
}
function showScreen(s){
  setScreen(s);
  $('scrTitle').hidden=s!=='title';$('scrGame').hidden=s!=='game';$('scrEnd').hidden=s!=='end';
  $('quitBtn').hidden=s!=='game';$('quitBtn').textContent=L('Run abbrechen','Abandon run');$('quitBtn').classList.remove('warn');
  if(s==='title'){renderClasses();renderScores($('hsTitle'));loadGlobal($('gsTitle'));drawPreview();$('topInfo').textContent=TOP_TITLE()}
  if(s==='game')window.scrollTo(0,0);
  if(s==='end'){renderEnd();$('topInfo').textContent=TOP_END();window.scrollTo(0,0)}
}
function lpLine(k){
  const l=lp(k),nx=UNL.findIndex(t=>l<t);
  return`<span class="lp">${LP()} ${l} · ${nx<0?L('alles freigeschaltet','everything unlocked'):L(`bei ${UNL[nx]} LP: ${UNLD[k][nx]}`,`at ${UNL[nx]} VP: ${UNLD[k][nx]}`)}${UNLD[k].filter((_,i)=>l>=UNL[i]).map(t=>`<br>✓ ${t}`).join('')}</span>`;
}
function renderClasses(){
  const box=$('classes');box.innerHTML='';
  Object.entries(CLS).forEach(([k,c])=>{
    const b=document.createElement('button');b.className='cls';b.setAttribute('aria-pressed',k===S.sel?'true':'false');
    b.innerHTML=`<img alt="" src="${iconURL(playerSpr(k),'cls_'+k,48)}"><span class="nm">${c.n}</span><span class="st">${L(`TP ${c.hp} · Angriff ${c.atk} · Panzerung ${c.def} · Bewegung ${c.mp}`,`HP ${c.hp} · Attack ${c.atk} · Armor ${c.def} · Move ${c.mp}`)}</span><span class="ab"><b>${c.ab}</b> ${c.abd}</span><span class="gear">${c.gear}</span>${lpLine(k)}`;
    b.onclick=()=>{setSel(k);renderClasses()};box.append(b);
  });
}
function drawPreview(){
  const x=$('pv').getContext('2d');const s=normSeed($('seedIn').value);
  x.fillStyle='#05070a';x.fillRect(0,0,68,52);
  if(!s){$('pvCap').textContent=L('Gib einen Seed ein oder würfle einen.','Enter a seed or roll one.');return}
  const d=genRoom(s,1,'','L');
  for(let i=0;i<RW*RH;i++){const t=d.map[i],px=(i%RW)*4,py=((i/RW)|0)*4;
    x.fillStyle=t===WALL?'#2d3743':t===BLOCK?'#6b5a3a':t===DOOR?'#ffb000':'#1d2631';x.fillRect(px,py,4,4);
    if(t===FLOOR){x.fillStyle='#141b23';x.fillRect(px+3,py,1,4);x.fillRect(px,py+3,4,1)}}
  x.fillStyle='#5fd3e6';x.fillRect(d.start.x*4,d.start.y*4,4,4);
  $('pvCap').textContent=L(`Raum 1, ${d.name}. Blau: du, Braun: Deckung, Gelb: Türen. Gegner siehst du erst drinnen.`,`Room 1, ${d.name}. Blue: you, brown: cover, yellow: doors. You only see enemies once inside.`);
}

on('screen',showScreen);
/* Sprachwechsel: sichtbaren Bildschirm neu beschriften, ohne neu zu laden oder zu scrollen */
on('lang',()=>{
  const s=S.screen;
  $('quitBtn').textContent=L('Run abbrechen','Abandon run');$('quitBtn').classList.remove('warn');
  if(s==='title'){renderClasses();renderScores($('hsTitle'));drawPreview();$('topInfo').textContent=TOP_TITLE()}
  if(s==='end'){renderEnd();$('topInfo').textContent=TOP_END()}
  for(const [el,[list,hl]] of lastGlobal)if(!el.closest('[hidden]'))renderGlobal(el,list,hl);
});

export {showScreen,renderClasses,drawPreview,sendScore};
