// Statuskonsole, Rundenleiste, Inventar und Log (DOM). Wird bei jedem "change" neu gezeichnet.
import {RW,ROOMS,INV,TIERNAME,CLS,AB2,MON,IT,tierOf,roomTitle} from '../core/config.js';
import {L,nf} from '../core/i18n.js';
import {cheb} from '../core/geometry.js';
import {S,PERKS,atk,def,need,score,canInput,canSee,itemAt,unl,useItem,dropItem,takePerk} from '../core/game.js';
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
  $('topInfo').textContent=`Seed ${G.seed} · ${c.n}`;
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
    return`<div class="row"><img alt="" src="${iconURL(monSpr(m.t),'m_'+m.t,32)}"><span>${d.n}${m.elite?' (Elite)':''}</span><span class="mbar"><i style="width:${Math.max(0,m.hp/m.max*100)}%"></i></span><span class="st ${cl}">${s} · ${cheb(m,p)} ${cheb(m,p)===1?L('Feld','tile'):L('Felder','tiles')}</span></div>`}).join('')
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
function flashStage(){const s=$('stage');s.classList.add('hurt');setTimeout(()=>s.classList.remove('hurt'),220)}

on('change',renderHud);
on('lang',renderHud);
on('banner',banner);
on('hurt',flashStage);

export {renderHud,banner};
