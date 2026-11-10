// Statuskonsole, Rundenleiste, Inventar und Log (DOM). Wird bei jedem "change" neu gezeichnet.
import {RW,ROOMS,INV,TIERNAME,CLS,AB2,MON,IT,tierOf,roomTitle} from '../core/config.js';
import {L,nf} from '../core/i18n.js';
import {cheb} from '../core/geometry.js';
import {S,PERKS,atk,def,need,score,dodge,canInput,canSee,itemAt,unl,useItem,dropItem,takePerk} from '../core/game.js';
import {on} from '../core/bus.js';
import {esc} from './esc.js';
import {iconURL,itemSpr,monSpr} from '../render/sprites.js';

const $=id=>document.getElementById(id);

function banner(text,kind){const b=$('banner');b.textContent=text;b.className='banner on '+(kind||'');clearTimeout(banner.t);banner.t=setTimeout(()=>b.classList.remove('on'),1300)}
function pips(n,max,cls){return`<span class="pips${cls?' '+cls:''}">${Array.from({length:max},(_,i)=>`<span class="${i<n?'on':''}"></span>`).join('')}</span>`}
function renderHud(){
  const G=S.G,busy=S.busy,VIS=S.VIS;if(!G)return;const p=G.p,c=CLS[G.cls];
  const tb=$('turnBar');tb.className='turn'+(G.phase==='enemy'?' enemy':G.phase==='explore'?' clear':'');
  $('rndTxt').textContent=G.phase==='explore'?L('Gesichert','Secured'):L(`Runde ${G.round}`,`Round ${G.round}`);
  $('phTxt').textContent=G.phase==='enemy'?L('Gegnerzug','Enemy turn'):G.phase==='explore'?L('Raum frei','Room clear'):L('Dein Zug','Your turn');
  const endB=$('endBtn');
  if(G.phase==='player'){
    let hint='';
    if(G.target)hint=G.target.kind==='nade'?L('Zielfeld für die Granate wählen','Pick a target tile for the grenade'):L('Ziel wählen','Pick a target');
    else if(p.mp<=0&&p.act<=0)hint=L('Alles verbraucht, Gegner sind gleich dran','All used up, the enemies move next');
    $('resBox').innerHTML=`<span class="grp">${L('Bewegung','Move')} ${pips(p.mp,c.mp)}</span><span class="grp">${L('Aktion','Action')} ${pips(p.act,1,'a')}</span>${hint?`<span class="msg">${hint}</span>`:''}`;
    endB.hidden=false;endB.disabled=busy;endB.textContent=L('Zug beenden','End turn');
  }else if(G.phase==='enemy'){
    $('resBox').innerHTML=`<span class="msg">${L('Die Gegner ziehen nacheinander. Gleich bist du wieder dran.','The enemies move one by one. Your turn comes right after.')}</span>`;endB.hidden=false;endB.disabled=true;endB.textContent=L('Bitte warten','Please wait');
  }else{
    $('resBox').innerHTML=`<span class="msg">${G.boss?L('Lauf zur Rettungskapsel.','Run to the escape pod.'):G.exits.length>1?L('Bewegung frei. Sammle die Beute und geh durch eine der offenen Türen.','Free movement. Grab the loot and go through one of the open doors.'):L('Bewegung frei. Die Schleuse zur Brutkammer ist offen.','Free movement. The airlock to the brood chamber is open.')}</span>`;endB.hidden=true;
  }
  const pct=Math.max(0,p.hp/p.max);const bar=$('hpBar');bar.querySelector('i').style.width=(pct*100)+'%';bar.className='bar '+(pct>.6?'ok':pct>.3?'mid':'');
  $('hpTxt').textContent=`${p.hp}/${p.max}`;$('ammoTxt').textContent=p.ammo;$('roomTxt').textContent=`${G.room}/${ROOMS}`;
  $('topInfo').textContent=G.tut?L('Tutorial · Übungsraum','Tutorial · training room'):`Seed ${G.seed} · ${c.n}`;
  $('deckLbl').textContent=TIERNAME[tierOf(G.room)-1];
  $('roomName').textContent=`${L('Raum','Room')} ${G.room} · ${roomTitle(G.name)}`;
  $('roomPips').innerHTML=Array.from({length:ROOMS},(_,i)=>{const n=i+1;let k=n<G.room||(n===G.room&&G.phase==='explore')?'on':n===G.room?'now':'';if(n===ROOMS)k='boss'+(n===G.room?' now':'');return`<span class="${k}"></span>`}).join('');
  const st=[[L('Angriff','Attack'),atk()+(p.stim>0?' (Stim)':'')],[L('Panzerung','Armor'),def()],[L('Stufe','Level'),`${p.lvl} · ${L('EP','XP')} ${p.xp}/${need(p.lvl)}`],[L('Abschüsse','Kills'),G.kills],[L('Runden gesamt','Total rounds'),G.rounds],[L('Punkte','Score'),nf(score())]];
  $('stats').innerHTML=st.map(([a,b])=>`<dt>${a}</dt><dd>${b}</dd>`).join('');
  const chips=[];if(p.stim>0)chips.push(`<span class="chip a">${L('Stimulans','Stim')} ${p.stim}</span>`);if(p.invis>0)chips.push(`<span class="chip">${L('Getarnt','Cloaked')}</span>`);if(p.shield>0)chips.push(`<span class="chip">${L('Schild','Shield')} ${p.shield}</span>`);
  $('chips').innerHTML=chips.join('');
  $('equip').innerHTML=`<dt>${L('Waffe','Weapon')}</dt><dd>${p.wpn?`${IT[p.wpn].n} (+${IT[p.wpn].v})`:L('Fäuste','Fists')}</dd><dt>${L('Schutz','Armor')}</dt><dd>${p.arm?`${IT[p.arm].n} (+${IT[p.arm].v})`:L('Overall','Overalls')}</dd><dt>Blaster</dt><dd>${p.ammo} ${L('Schuss','rounds')}</dd>${CLS[G.cls].side?`<dt>${L('Reserve','Backup')}</dt><dd>${CLS[G.cls].side}</dd>`:''}`;
  const inv=$('inv');inv.innerHTML='';
  for(let i=0;i<INV;i++){const k=p.inv[i];const row=document.createElement('div');row.className='slotrow';const b=document.createElement('button');b.className='slot';row.append(b);
    if(!k){b.disabled=true;b.innerHTML=`<span class="kbd">${i+1}</span><span class="empty">${L('leer','empty')}</span>`}
    else{const d=IT[k];const ds=d.slot?(d.slot==='wpn'?L(`+${d.v} Angriff · ausrüsten`,`+${d.v} attack · equip`):L(`+${d.v} Panzerung · ausrüsten`,`+${d.v} armor · equip`)):d.d;
      b.innerHTML=`<span class="kbd">${i+1}</span><img alt="" src="${iconURL(itemSpr(k),'i_'+k,32)}"><span class="nm">${d.n}</span><span class="ds">${ds}</span>`;
      b.disabled=!canInput();b.onclick=()=>useItem(i);
      const x=document.createElement('button');x.className='drop';x.textContent='✕';x.title=L('Ablegen','Drop');x.setAttribute('aria-label',L(`${d.n} ablegen`,`Drop ${d.n}`));x.disabled=!canInput();x.onclick=()=>dropItem(i);row.append(x)}
    inv.append(row)}
  const under=itemAt(p.x,p.y);
  $('invHint').textContent=under?L(`Unter dir: ${IT[under.k].n}. Klick auf dein Feld oder G hebt es auf${p.inv.length>=INV?', ✕ tauscht direkt':''}.`,`Under you: ${IT[under.k].n}. Click your tile or press G to pick it up${p.inv.length>=INV?', ✕ swaps directly':''}.`)
    :L('Benutzen kostet im Kampf deine Aktion. Ablegen mit ✕ ist kostenlos.','In combat, using an item costs your action. Dropping with ✕ is free.');
  const seenM=G.mons.filter(m=>m.hp>0&&VIS[m.x+m.y*RW]).sort((a,b)=>cheb(a,p)-cheb(b,p));
  $('seenList').innerHTML=seenM.length?seenM.slice(0,6).map(m=>{const d=MON[m.t];
    let s,cl='';if(m.stun>0){s=L(`gelähmt (${m.stun})`,`stunned (${m.stun})`);cl='stun'}else if(!m.aware){s=L('hat dich noch nicht bemerkt','hasn’t noticed you yet')}else if(canSee(m)){s=L('sieht dich','sees you');cl='see'}else{s=L('sucht dich','searching for you')}
    const open=openMon===m.id;
    return`<button class="row" data-mid="${m.id}" aria-expanded="${open}"><img alt="" src="${iconURL(monSpr(m.t),'m_'+m.t,32)}"><span>${d.n}${m.elite?' (Elite)':''}</span><span class="mbar"><i style="width:${Math.max(0,m.hp/m.max*100)}%"></i></span><span class="st ${cl}">${s} · ${cheb(m,p)} ${cheb(m,p)===1?L('Feld','tile'):L('Felder','tiles')}</span></button>${open?monInfo(m):''}`}).join('')
    :`<p class="muted">${G.phase==='explore'?L('Raum gesichert.','Room secured.'):L('Niemand in Sichtlinie. Hinter der Deckung kann trotzdem etwas lauern.','Nobody in line of sight. Something may still lurk behind the cover.')}</p>`;
  const ab=$('abBtn');$('abName').textContent=c.ab;
  $('abSub').textContent=G.phase!=='player'?L('nur im Kampf','combat only'):p.cd>0?L(`lädt ${p.cd} Rd. · R`,`charging ${p.cd} rd. · R`):p.act>0?L('bereit · R','ready · R'):L('Aktion verbraucht','action used');
  ab.classList.toggle('ready',G.phase==='player'&&p.cd===0&&p.act>0);ab.disabled=!(G.phase==='player'&&!busy);
  const a2=AB2[G.cls],b2=$('ab2Btn');b2.hidden=!(a2&&unl(2));
  if(!b2.hidden){$('ab2Name').textContent=a2.n;$('ab2Sub').textContent=G.phase!=='player'?L('nur im Kampf','combat only'):p.cd2>0?L(`lädt ${p.cd2} Rd. · T`,`charging ${p.cd2} rd. · T`):p.act>0?L('bereit · T','ready · T'):L('Aktion verbraucht','action used');
    b2.classList.toggle('ready',G.phase==='player'&&!(p.cd2>0)&&p.act>0);b2.disabled=!(G.phase==='player'&&!busy)}
  const lu=$('lvlUp'),lk=G.offer&&G.alive?`${p.lvl}|${G.picks}|${G.offer}|${L('de','en')}`:'';lu.hidden=!lk;
  if(lk&&lu.dataset.k!==lk){lu.dataset.k=lk;
    lu.innerHTML=`<p class="lbl">${L(`Stufe ${p.lvl} · wähle ein Upgrade`,`Level ${p.lvl} · choose an upgrade`)}</p>`+G.offer.map((k,i)=>`<button class="card" data-i="${i}"><span class="kbd">${i+1}</span><b>${PERKS[k].n}</b><span>${PERKS[k].d}</span></button>`).join('');
    lu.querySelectorAll('.card').forEach(b=>b.onclick=()=>takePerk(+b.dataset.i))}
  if(!lk)lu.dataset.k='';
  const fb=$('fireBtn');fb.disabled=!(G.phase==='player'&&!busy);fb.classList.toggle('aim',!!G.target);
  $('fireName').textContent=G.target?L('Abbrechen','Cancel'):L('Schießen','Shoot');$('fireSub').textContent=G.target?'Esc':`${p.ammo<=0&&CLS[G.cls].side?CLS[G.cls].side:p.ammo+' '+L('Schuss','rounds')} · F`;
  // Log-Einträge können aus einem gespeicherten Run stammen: nur als Text einsetzen, Art nur aus bekannter Liste
  $('log').innerHTML=G.log.slice(0,9).map(l=>`<p class="${LOGK.includes(l.k)?l.k:'info'}">${esc(l.t)}</p>`).join('');
}
const LOGK=['info','warn','good','hurt','dim','sep'];
/* ---------- Gegner-Infos ----------
   Klick auf einen Gegner in der Liste klappt seine Werte auf. Die Zahlen folgen den Regeln in core/game.js
   (monAttack, melee, shootAt): Dort ändern heißt hier mitändern. */
let openMon=null;
const MONINFO={
  larva:()=>L('Schwach, aber flink. Die Brutmutter stößt immer neue aus.','Weak but quick. The Brood Mother keeps expelling new ones.'),
  drone:()=>L('Maschine: Der EMP-Impuls richtet 6 Schaden an. Lässt oft eine Energiezelle fallen.','Machine: the EMP pulse deals 6 damage. Often drops an energy cell.'),
  mutant:()=>L('Langsam, hält aber einiges aus.','Slow, but takes a beating.'),
  turret:()=>L('Steht fest und schießt bis zu 6 Felder weit, sobald es dich sieht. Kein Nahkampf. Maschine. Deckung hilft.','Fixed in place and shoots up to 6 tiles as soon as it sees you. No melee. Machine. Cover helps.'),
  hunter:()=>L('Sehr schnell: Er holt dich fast immer ein. Schwäch ihn, bevor er bei dir ist.','Very fast: it almost always catches you. Weaken it before it reaches you.'),
  walker:()=>L('Schwer gepanzert, Schüsse und Schläge verlieren viel Wirkung. Langsam. Maschine.','Heavily armored, shots and blows lose much of their effect. Slow. Machine.'),
  queen:()=>L('Boss. Spuckt bis zu 5 Felder weit (6 Schaden, jede zweite Runde) und stößt alle 3 Runden eine Larve aus. Der EMP-Impuls lähmt sie nur 1 Runde.','Boss. Spits up to 5 tiles (6 damage, every other round) and expels a larva every 3 rounds. The EMP pulse stuns her for only 1 round.'),
};
const range=(a,b)=>a===b?`${a}`:`${a}–${b}`;
function monInfo(m){
  const G=S.G,p=G.p,d=MON[m.t],c=CLS[G.cls];
  const ma=d.atk+(m.elite?1:0),hit=Math.round((.8-dodge())*100);
  const dmgIn=range(Math.max(1,ma-1-def()),Math.max(1,ma+1-def()));
  const mel=range(Math.max(1,atk()-1-d.def),Math.max(1,atk()+1-d.def));
  const weak=p.ammo<=0&&!!c.side&&!unl(0),base=weak?2:4+Math.floor(p.lvl/2),hd=Math.floor(d.def/2);
  const shot=p.ammo>0||c.side?range(Math.max(1,base-hd),Math.max(1,base+(weak?1:2)-hd)):null;
  const rows=[[L('Lebenspunkte','Hit points'),`${Math.max(0,m.hp)} / ${m.max}`],[L('Angriff','Attack'),ma],[L('Panzerung','Armor'),d.def],
    [L('Bewegung','Move'),d.mp?L(`${d.mp} Felder`,`${d.mp} tiles`):L('keine','none')]];
  if(d.range)rows.push([L('Reichweite','Range'),L(`${d.range} Felder`,`${d.range} tiles`)]);
  return`<div class="info"><dl>${rows.map(([k,v])=>`<dt>${k}</dt><dd>${v}</dd>`).join('')}</dl>
<p class="you">${L(`Trifft dich zu ${hit} % für ${dmgIn} Schaden.`,`Hits you ${hit} % of the time for ${dmgIn} damage.`)}<br>${L(`Dein Nahkampf: ${mel} Schaden`,`Your melee: ${mel} damage`)}${shot?L(` · dein Schuss: ${shot}`,` · your shot: ${shot}`):''}</p>
<p>${MONINFO[m.t]()}${m.elite?' '+L('Elite: mehr Lebenspunkte, +1 Angriff, doppelte Erfahrung, lässt immer Beute fallen.','Elite: more hit points, +1 attack, double experience, always drops loot.'):''}</p></div>`;
}
$('seenList').addEventListener('click',e=>{const b=e.target.closest('.row');if(!b)return;const id=+b.dataset.mid;openMon=openMon===id?null:id;renderHud()});
on('reset',()=>{openMon=null});

function flashStage(){const s=$('stage');s.classList.add('hurt');setTimeout(()=>s.classList.remove('hurt'),220)}

on('change',renderHud);
on('lang',renderHud);
on('banner',banner);
on('hurt',flashStage);

export {renderHud,banner};
