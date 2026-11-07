// Statuskonsole, Rundenleiste, Inventar und Log (DOM). Wird bei jedem "change" neu gezeichnet.
import {RW,ROOMS,INV,TIERNAME,CLS,AB2,MON,IT,tierOf} from '../core/config.js';
import {cheb} from '../core/geometry.js';
import {S,PERKS,atk,def,need,score,canInput,canSee,itemAt,unl,useItem,dropItem,takePerk} from '../core/game.js';
import {on} from '../core/bus.js';
import {iconURL,itemSpr,monSpr} from '../render/sprites.js';

const $=id=>document.getElementById(id);

function banner(text,kind){const b=$('banner');b.textContent=text;b.className='banner on '+(kind||'');clearTimeout(banner.t);banner.t=setTimeout(()=>b.classList.remove('on'),1300)}
function pips(n,max,cls){return`<span class="pips${cls?' '+cls:''}">${Array.from({length:max},(_,i)=>`<span class="${i<n?'on':''}"></span>`).join('')}</span>`}
function renderHud(){
  const G=S.G,busy=S.busy,VIS=S.VIS;if(!G)return;const p=G.p,c=CLS[G.cls];
  const tb=$('turnBar');tb.className='turn'+(G.phase==='enemy'?' enemy':G.phase==='explore'?' clear':'');
  $('rndTxt').textContent=G.phase==='explore'?'Gesichert':`Runde ${G.round}`;
  $('phTxt').textContent=G.phase==='enemy'?'Gegnerzug':G.phase==='explore'?'Raum frei':'Dein Zug';
  const endB=$('endBtn');
  if(G.phase==='player'){
    let hint='';
    if(G.target)hint=G.target.kind==='nade'?'Zielfeld für die Granate wählen':'Ziel wählen';
    else if(p.mp<=0&&p.act<=0)hint='Alles verbraucht, Gegner sind gleich dran';
    $('resBox').innerHTML=`<span class="grp">Bewegung ${pips(p.mp,c.mp)}</span><span class="grp">Aktion ${pips(p.act,1,'a')}</span>${hint?`<span class="msg">${hint}</span>`:''}`;
    endB.hidden=false;endB.disabled=busy;endB.textContent='Zug beenden';
  }else if(G.phase==='enemy'){
    $('resBox').innerHTML='<span class="msg">Die Gegner ziehen nacheinander. Gleich bist du wieder dran.</span>';endB.hidden=false;endB.disabled=true;endB.textContent='Bitte warten';
  }else{
    $('resBox').innerHTML=`<span class="msg">${G.boss?'Lauf zur Rettungskapsel.':G.exits.length>1?'Bewegung frei. Sammle die Beute und geh durch eine der offenen Türen.':'Bewegung frei. Die Schleuse zur Brutkammer ist offen.'}</span>`;endB.hidden=true;
  }
  const pct=Math.max(0,p.hp/p.max);const bar=$('hpBar');bar.querySelector('i').style.width=(pct*100)+'%';bar.className='bar '+(pct>.6?'ok':pct>.3?'mid':'');
  $('hpTxt').textContent=`${p.hp}/${p.max}`;$('ammoTxt').textContent=p.ammo;$('roomTxt').textContent=`${G.room}/${ROOMS}`;
  $('topInfo').textContent=`Seed ${G.seed} · ${c.n}`;
  $('deckLbl').textContent=TIERNAME[tierOf(G.room)-1];
  $('roomName').textContent=`Raum ${G.room} · ${G.name}`;
  $('roomPips').innerHTML=Array.from({length:ROOMS},(_,i)=>{const n=i+1;let k=n<G.room||(n===G.room&&G.phase==='explore')?'on':n===G.room?'now':'';if(n===ROOMS)k='boss'+(n===G.room?' now':'');return`<span class="${k}"></span>`}).join('');
  const st=[['Angriff',atk()+(p.stim>0?' (Stim)':'')],['Panzerung',def()],['Stufe',`${p.lvl} · EP ${p.xp}/${need(p.lvl)}`],['Abschüsse',G.kills],['Runden gesamt',G.rounds],['Punkte',score().toLocaleString('de-DE')]];
  $('stats').innerHTML=st.map(([a,b])=>`<dt>${a}</dt><dd>${b}</dd>`).join('');
  const chips=[];if(p.stim>0)chips.push(`<span class="chip a">Stimulans ${p.stim}</span>`);if(p.invis>0)chips.push(`<span class="chip">Getarnt</span>`);if(p.shield>0)chips.push(`<span class="chip">Schild ${p.shield}</span>`);
  $('chips').innerHTML=chips.join('');
  $('equip').innerHTML=`<dt>Waffe</dt><dd>${p.wpn?`${IT[p.wpn].n} (+${IT[p.wpn].v})`:'Fäuste'}</dd><dt>Schutz</dt><dd>${p.arm?`${IT[p.arm].n} (+${IT[p.arm].v})`:'Overall'}</dd><dt>Blaster</dt><dd>${p.ammo} Schuss</dd>${CLS[G.cls].side?`<dt>Reserve</dt><dd>${CLS[G.cls].side}</dd>`:''}`;
  const inv=$('inv');inv.innerHTML='';
  for(let i=0;i<INV;i++){const k=p.inv[i];const row=document.createElement('div');row.className='slotrow';const b=document.createElement('button');b.className='slot';row.append(b);
    if(!k){b.disabled=true;b.innerHTML=`<span class="kbd">${i+1}</span><span class="empty">leer</span>`}
    else{const d=IT[k];const ds=d.slot?(d.slot==='wpn'?`+${d.v} Angriff · ausrüsten`:`+${d.v} Panzerung · ausrüsten`):d.d;
      b.innerHTML=`<span class="kbd">${i+1}</span><img alt="" src="${iconURL(itemSpr(k),'i_'+k,24)}"><span class="nm">${d.n}</span><span class="ds">${ds}</span>`;
      b.disabled=!canInput();b.onclick=()=>useItem(i);
      const x=document.createElement('button');x.className='drop';x.textContent='✕';x.title='Ablegen';x.setAttribute('aria-label',`${d.n} ablegen`);x.disabled=!canInput();x.onclick=()=>dropItem(i);row.append(x)}
    inv.append(row)}
  const under=itemAt(p.x,p.y);
  $('invHint').textContent=under?`Unter dir: ${IT[under.k].n}. Klick auf dein Feld oder G hebt es auf${p.inv.length>=INV?', ✕ tauscht direkt':''}.`:'Benutzen kostet im Kampf deine Aktion. Ablegen mit ✕ ist kostenlos.';
  const seenM=G.mons.filter(m=>m.hp>0&&VIS[m.x+m.y*RW]).sort((a,b)=>cheb(a,p)-cheb(b,p));
  $('seenList').innerHTML=seenM.length?seenM.slice(0,6).map(m=>{const d=MON[m.t];
    let s,cl='';if(m.stun>0){s=`gelähmt (${m.stun})`;cl='stun'}else if(!m.aware){s='hat dich noch nicht bemerkt'}else if(canSee(m)){s='sieht dich';cl='see'}else{s='sucht dich'}
    return`<div class="row"><img alt="" src="${iconURL(monSpr(m.t),'m_'+m.t,20)}"><span>${d.n}${m.elite?' (Elite)':''}</span><span class="mbar"><i style="width:${Math.max(0,m.hp/m.max*100)}%"></i></span><span class="st ${cl}">${s} · ${cheb(m,p)} ${cheb(m,p)===1?'Feld':'Felder'}</span></div>`}).join('')
    :`<p class="muted">${G.phase==='explore'?'Raum gesichert.':'Niemand in Sichtlinie. Hinter der Deckung kann trotzdem etwas lauern.'}</p>`;
  const ab=$('abBtn');$('abName').textContent=c.ab;
  $('abSub').textContent=G.phase!=='player'?'nur im Kampf':p.cd>0?`lädt ${p.cd} Rd. · R`:p.act>0?'bereit · R':'Aktion verbraucht';
  ab.classList.toggle('ready',G.phase==='player'&&p.cd===0&&p.act>0);ab.disabled=!(G.phase==='player'&&!busy);
  const a2=AB2[G.cls],b2=$('ab2Btn');b2.hidden=!(a2&&unl(2));
  if(!b2.hidden){$('ab2Name').textContent=a2.n;$('ab2Sub').textContent=G.phase!=='player'?'nur im Kampf':p.cd2>0?`lädt ${p.cd2} Rd. · T`:p.act>0?'bereit · T':'Aktion verbraucht';
    b2.classList.toggle('ready',G.phase==='player'&&!(p.cd2>0)&&p.act>0);b2.disabled=!(G.phase==='player'&&!busy)}
  const lu=$('lvlUp'),lk=G.offer&&G.alive?`${p.lvl}|${G.picks}|${G.offer}`:'';lu.hidden=!lk;
  if(lk&&lu.dataset.k!==lk){lu.dataset.k=lk;
    lu.innerHTML=`<p class="lbl">Stufe ${p.lvl} · wähle ein Upgrade</p>`+G.offer.map((k,i)=>`<button class="card" data-i="${i}"><span class="kbd">${i+1}</span><b>${PERKS[k].n}</b><span>${PERKS[k].d}</span></button>`).join('');
    lu.querySelectorAll('.card').forEach(b=>b.onclick=()=>takePerk(+b.dataset.i))}
  if(!lk)lu.dataset.k='';
  const fb=$('fireBtn');fb.disabled=!(G.phase==='player'&&!busy);fb.classList.toggle('aim',!!G.target);
  $('fireName').textContent=G.target?'Abbrechen':'Schießen';$('fireSub').textContent=G.target?'Esc':`${p.ammo<=0&&CLS[G.cls].side?CLS[G.cls].side:p.ammo+' Schuss'} · F`;
  $('log').innerHTML=G.log.slice(0,9).map(l=>`<p class="${l.k}">${l.t}</p>`).join('');
}
function flashStage(){const s=$('stage');s.classList.add('hurt');setTimeout(()=>s.classList.remove('hurt'),220)}

on('change',renderHud);
on('banner',banner);
on('hurt',flashStage);

export {renderHud,banner};
