// Spiellogik von Wrack Ikarus: Regeln, Runden, Kampf, Items, Gegner-KI.
// Kein DOM, keine Grafik: Alles, was sichtbar oder hörbar wird, geht als Ereignis über den Bus.
// Der Regelcode ist aus der klassischen Version übernommen und dort Zeile für Zeile gleich.
import {RW,RH,ROOMS,INV,FLOOR,DOOR,EXIT,POD,D8,OPP,CLS,UNL,UNLD,AB2,MON,IT,ITABLE,tierOf} from './config.js';
import {h32,wpick,dailyDay} from './rng.js';
import {solidT,cheb,losMap,canStep} from './geometry.js';
import {sideTile,genRoom} from './roomgen.js';
import {saveScore,addLP,lp,storeRun} from './storage.js';
import {emit} from './bus.js';
import {L,localize} from './i18n.js';

/* Zeitsteuerung: scale 0 lässt Tests und das Nachspielen auf dem Server ohne Wartezeiten laufen
   (Pausen werden dann sofort fortgesetzt). save:false spart beim Nachspielen das Speichern. */
const timing={scale:1,save:true};
const sleep=ms=>timing.scale?new Promise(r=>setTimeout(r,ms*timing.scale)):Promise.resolve();
/* Verzögerte Aufgabe; sie verfällt, wenn inzwischen ein anderer Run läuft (neu gestartet oder neu geladen) */
const later=(fn,ms)=>{const run=G;setTimeout(()=>{if(G===run)fn()},ms*timing.scale)};

/* Brücken zur Darstellung */
const fx={push:o=>emit('fx',o)};
const SFX=new Proxy({},{get:(_,k)=>()=>emit('sfx',k)});
const banner=(t,k)=>emit('banner',t,k);
const flashStage=()=>emit('hurt');
function updateUI(){saveRun();emit('change')}
function showScreen(s){screen=s;emit('screen',s)}

const PERKS={
 hp:{n:'Zähigkeit',d:'Max. TP +6, heilt 6',f:p=>{p.max+=6;p.hp=Math.min(p.max,p.hp+6)}},
 atk:{n:'Kraft',d:'Angriff +1',f:p=>{p.atk++}},
 def:{n:'Panzerplatten',d:'Panzerung +1',f:p=>{p.def++}},
 ammo:{n:'Munitionsgurt',d:'+3 Schuss',f:p=>{p.ammo+=3}},
 dodge:{n:'Reflexe',d:'Ausweichen +5 %',ok:()=>dodge()<.5,f:p=>{p.dodge=(p.dodge||0)+.05}},
 cd:{n:'Fokus',d:'Abklingzeit der Fähigkeit −1',ok:()=>abCd()>1,f:p=>{p.cdr=(p.cdr||0)+1}},
 med:{n:'Nachschub',d:'ein Medi-Injektor ins Inventar',ok:()=>G.p.inv.length<INV,f:p=>{p.inv.push('med')}}};
localize(PERKS,{hp:{n:'Toughness',d:'Max HP +6, heals 6'},atk:{n:'Strength',d:'Attack +1'},def:{n:'Armor Plating',d:'Armor +1'},
 ammo:{n:'Ammo Belt',d:'+3 rounds'},dodge:{n:'Reflexes',d:'Dodge +5 %'},cd:{n:'Focus',d:'Ability cooldown −1'},med:{n:'Resupply',d:'one Med Injector into your inventory'}});
/* Plural für Runden/Felder */
const rounds_=n=>L(`${n} Runde${n>1?'n':''}`,`${n} round${n>1?'s':''}`);
const ACTION_USED=()=>L('Deine Aktion ist schon verbraucht.','Your action is already used up.');
const AIM_CANCEL=()=>L('Zielen abgebrochen.','Aiming cancelled.');
function rnd(){const a=(G.rs=(G.rs+0x6D2B79F5)|0);let t=Math.imul(a^a>>>15,1|a);t=t+Math.imul(t^t>>>7,61|t)^t;return((t^t>>>14)>>>0)/4294967296}
const ri=(a,b)=>a+Math.floor(rnd()*(b-a+1));
const los=(a,b)=>losMap(G.map,a,b);
let G=null,VIS=new Uint8Array(RW*RH),REACH=new Int16Array(RW*RH).fill(-1),PARENT=new Int16Array(RW*RH).fill(-1);
let screen='title',sel='marine',hurtT=0,finishing=false,busy=false,hover=null,pendingEnd=false;
const atk=()=>G.p.atk+(G.p.wpn?IT[G.p.wpn].v:0)+(G.p.stim>0?3:0);
const def=()=>G.p.def+(G.p.arm?IT[G.p.arm].v:0);
const need=l=>8+l*6;
const dodge=()=>(CLS[G.cls].dodge||0)+(G.p.dodge||0);
const abCd=()=>Math.max(1,CLS[G.cls].cd-(G.cls==='marine'&&unl(1)?1:0)-(G.p.cdr||0));
const score=()=>G.xpTotal*10+G.cleared*150+(G.win?2500+Math.max(0,1500-G.rounds*12):0);
const live=()=>screen==='game'&&G&&G.alive&&!G.over;
const canInput=()=>live()&&!busy&&!G.offer&&(G.phase==='player'||G.phase==='explore');
const inCombat=()=>G.phase==='player';
const monAt=(x,y)=>G.mons.find(m=>m.hp>0&&m.x===x&&m.y===y);
const visMonAt=(x,y)=>{const m=monAt(x,y);return m&&VIS[x+y*RW]?m:null};
const itemAt=(x,y)=>G.items.find(i=>i.x===x&&i.y===y);
const mAtk=m=>MON[m.t].atk+(m.elite?1:0);
const mName=m=>MON[m.t].nom;
const canSee=m=>G.p.invis<=0&&cheb(m,G.p)<=10&&los(m,G.p);

function log(t,k){G.log.unshift({t,k:k||'info'});if(G.log.length>50)G.log.length=50}

function newMon(t,x,y,elite){const d=MON[t];const hp=elite?Math.round(d.hp*1.6):d.hp;return{id:G.nid++,t,x,y,hp,max:hp,elite:!!elite,stun:0,aware:false,known:null,gx:null,gy:null,spit:0,spawn:0}}

/* opts.day: nur beim Nachspielen auf dem Server (dort gilt das Datum des Originals, nicht das heutige) */
function startRun(seed,cls,opts){
  const c=CLS[cls];
  G={seed,cls,day:opts&&'day' in opts?opts.day:dailyDay(seed),lp0:lp(cls),rec:[],medArm:null,room:0,path:'',round:0,rounds:0,phase:'player',kills:0,xpTotal:0,cleared:0,alive:true,over:false,win:false,log:[],rs:h32(seed+'!kampf'),nid:1,cause:'',
     map:[],deco:[],mons:[],items:[],exits:[],entry:'L',name:'',elite:false,boss:false,bossDead:false,pod:null,target:null,active:null,
     p:{x:0,y:0,hp:c.hp,max:c.hp,atk:c.atk,def:c.def,lvl:1,xp:0,ammo:c.ammo,wpn:null,arm:null,inv:c.inv.slice(),cd:0,cd2:0,shield:0,dodge:0,cdr:0,invis:0,stim:0,mp:c.mp,act:1},offer:null,picks:0};
  if(unl(0))startPerk();
  finishing=false;busy=false;pendingEnd=false;hover=null;emit('reset');   // main.js schreibt dabei den Seed in die Adresszeile
  log(L('Andockschleuse offen. Die Luft riecht nach Ozon und etwas Süßlichem.','Docking airlock open. The air smells of ozone and something sweet.'),'warn');
  showScreen('game');
  enterRoom(1,'L');
}

function enterRoom(idx,entry){
  const d=genRoom(G.seed,idx,G.path,entry);
  Object.assign(G,{room:idx,map:d.map,deco:d.deco,items:[],exits:d.exits,entry,name:d.name,elite:d.elite,boss:d.boss,bossDead:false,pod:d.pod,round:0,target:null,active:null});
  G.mons=d.mons.map(m=>newMon(m.t,m.x,m.y,m.elite));
  G.p.x=d.start.x;G.p.y=d.start.y;
  log(L(`Raum ${idx}/${ROOMS}: ${d.name}. Die Tür hinter dir verriegelt.`,`Room ${idx}/${ROOMS}: ${d.name}. The door locks behind you.`),'info');
  if(d.boss)log(L('Die Wände sind mit Harz überzogen. Etwas Großes atmet.','The walls are coated in resin. Something big is breathing.'),'warn');
  else if(d.elite)log(L('Schwere Schritte irgendwo hinter der Deckung.','Heavy footsteps somewhere behind the cover.'),'warn');
  startRound();
}

/* ---------- Runden ---------- */
function startRound(){
  const p=G.p;G.round++;G.rounds++;
  if(p.cd>0)p.cd--;
  if(p.cd2>0)p.cd2--;
  if(p.shield>0){p.shield--;if(!p.shield)log(L('Der Schild bricht zusammen.','The shield collapses.'),'warn')}
  if(p.stim>0){p.stim--;if(!p.stim)log(L('Das Stimulans lässt nach.','The stim wears off.'),'dim')}
  if(p.invis>0){p.invis--;if(!p.invis)log(L('Das Tarnfeld erlischt.','The cloak field fades.'),'warn')}
  p.mp=CLS[G.cls].mp;p.act=1;G.phase='player';G.target=null;pendingEnd=false;
  log(L(`Runde ${G.round} · dein Zug`,`Round ${G.round} · your turn`),'sep');
  banner(L(`Runde ${G.round} · Dein Zug`,`Round ${G.round} · Your turn`),'you');
  computeVis();updateUI();
}
function endTurn(){
  if(!live()||busy||G.offer||G.phase!=='player')return;
  enemyPhase();
}
function autoEnd(){
  if(!G.offer&&G.phase==='player'&&G.p.mp<=0&&G.p.act<=0&&!pendingEnd&&live()){
    pendingEnd=true;later(()=>{pendingEnd=false;if(live()&&G.phase==='player'&&!busy&&G.p.mp<=0&&G.p.act<=0)endTurn()},500);
  }
}
async function enemyPhase(){
  G.phase='enemy';G.target=null;busy=true;hover=null;
  log(L('Gegnerzug','Enemy turn'),'sep');banner(L('Gegnerzug','Enemy turn'),'enemy');computeVis();updateUI();
  const run=G;   // Wird inzwischen ein neuer Run gestartet, hört dieser Gegnerzug auf
  await sleep(500);
  const list=G.mons.filter(m=>m.hp>0);
  for(const m of list){
    if(G!==run||!live())break;if(m.hp<=0)continue;
    G.active=m.id;await monTurn(m);if(G!==run)return;G.active=null;
    G.mons=G.mons.filter(x=>x.hp>0);computeVis();updateUI();
  }
  if(G!==run)return;
  busy=false;
  if(live()&&G.phase==='enemy')startRound();
}

/* ---------- Sicht & Reichweite ---------- */
function computeVis(){
  VIS=new Uint8Array(RW*RH);const p=G.p;
  for(let y=0;y<RH;y++)for(let x=0;x<RW;x++){if((x===p.x&&y===p.y)||los(p,{x,y}))VIS[x+y*RW]=1}
  for(const m of G.mons)if(m.hp>0&&VIS[m.x+m.y*RW]){m.gx=m.x;m.gy=m.y}
  REACH=new Int16Array(RW*RH).fill(-1);PARENT=new Int16Array(RW*RH).fill(-1);
  if(G.phase!=='player'&&G.phase!=='explore')return;
  const max=G.phase==='player'?p.mp:999;
  const s=p.x+p.y*RW;REACH[s]=0;const q=[s];let qi=0;
  while(qi<q.length){const i=q[qi++],x=i%RW,y=(i/RW)|0;if(REACH[i]>=max)continue;
    for(const[dx,dy]of D8){const nx=x+dx,ny=y+dy;if(!canStep(G.map,x,y,nx,ny))continue;const j=nx+ny*RW;if(REACH[j]>=0)continue;if(visMonAt(nx,ny))continue;REACH[j]=REACH[i]+1;PARENT[j]=i;q.push(j)}}
}
function pathTo(i){const out=[];let c=i;while(c>=0&&c!==G.p.x+G.p.y*RW){out.push(c);c=PARENT[c]}return out.reverse()}

/* ---------- Kampf ---------- */
function hitMon(m,dmg){
  m.hp-=dmg;m.aware=true;m.known={x:G.p.x,y:G.p.y};
  fx.push({type:'flash',x:m.x,y:m.y,t0:performance.now(),dur:180});
  if(m.hp<=0)killMon(m);
}
function killMon(m){
  const d=MON[m.t];G.kills++;log(L(`${d.nom} ist erledigt.`,`${d.nom} is down.`),'good');SFX.kill();gainXp(d.xp*(m.elite?2:1));
  if(d.boss){G.bossDead=true;log(L('Die Brutmutter bricht zusammen.','The Brood Mother collapses.'),'good')}
  dropLoot(m,d);
}
/* Beute: Larven selten, normale Gegner oft, Elite und Boss immer. Maschinen lassen oft Energiezellen fallen. */
function dropLoot(m,d){
  const chance=(m.elite||d.boss)?1:m.t==='larva'?.3:.6;
  if(rnd()>=chance)return;
  const k=d.boss?'med':(d.robot&&rnd()<.5)?'cell':wpick(ITABLE[tierOf(G.room)],rnd);
  const spot=[[0,0],...D8].map(([dx,dy])=>[m.x+dx,m.y+dy]).find(([x,y])=>x>0&&y>0&&x<RW-1&&y<RH-1&&G.map[x+y*RW]===FLOOR&&!itemAt(x,y)&&!(x===G.p.x&&y===G.p.y)&&!monAt(x,y));
  if(!spot)return;
  G.items.push({k,x:spot[0],y:spot[1]});
  fx.push({type:'drop',x:spot[0],y:spot[1],t0:performance.now(),dur:600});
  log(L(`Beute: ${IT[k].n}.`,`Loot: ${IT[k].n}.`),'good');
}
function gainXp(x){
  G.xpTotal+=x;const p=G.p;p.xp+=x;
  const was=lp(G.cls),now=addLP(G.cls,x);
  UNL.forEach((t,i)=>{if(was<t&&now>=t){log(L(`Freigeschaltet: ${UNLD[G.cls][i]}.`,`Unlocked: ${UNLD[G.cls][i]}.`),'good');banner(L('Neue Fähigkeit','New ability'),'good');if(i===0)startPerk()}});
  while(p.xp>=need(p.lvl)){p.xp-=need(p.lvl);p.lvl++;p.max+=2;p.hp=Math.min(p.max,p.hp+2);G.picks=(G.picks||0)+1;
    log(L(`Stufe ${p.lvl}! Max. TP +2. Wähle ein Upgrade.`,`Level ${p.lvl}! Max HP +2. Choose an upgrade.`),'good');SFX.lvl()}
  if(G.picks&&!G.offer)offerPerks();
}
function startPerk(){const p=G.p;if(G.cls==='marine'){p.max+=5;p.hp+=5}else if(G.cls==='tech')p.ammo+=4}
function offerPerks(){
  const ks=Object.keys(PERKS).filter(k=>!PERKS[k].ok||PERKS[k].ok());
  G.offer=[];while(G.offer.length<3&&ks.length)G.offer.push(ks.splice(Math.floor(rnd()*ks.length),1)[0]);
  G.target=null;
}
function takePerk(i){
  const k=G.offer&&G.offer[i];if(!k||!live())return;const d=PERKS[k];
  d.f(G.p);log(`Upgrade: ${d.n}, ${d.d}.`,'good');SFX.pick();
  G.offer=null;G.picks--;if(G.picks>0)offerPerks();
  computeVis();updateUI();autoEnd();
}
function hurtPlayer(dmg,cause){const p=G.p;p.hp-=dmg;hurtT=performance.now();flashStage();if(p.hp<=0){p.hp=0;die(cause)}}
/* Angriffsart: hit (Nahkampf), shoot (Geschütz), spit (Brutmutter) */
const VERB={hit:['trifft','hits'],shoot:['beschießt','shoots'],spit:['bespuckt','spits at']};
function monAttack(m,base,kind){
  const d=MON[m.t],verb=L(...VERB[kind]);
  const hit=rnd()<.8-dodge();
  if(hit&&G.p.shield>0){log(L(`${d.nom} ${verb} dich, der Schild hält.`,`${d.nom} ${verb} you, the shield holds.`),'dim');SFX.miss()}
  else if(hit){const dmg=Math.max(1,base+ri(-1,1)-def());log(L(`${d.nom} ${verb} dich: ${dmg} Schaden.`,`${d.nom} ${verb} you: ${dmg} damage.`),'hurt');SFX.hurt();hurtPlayer(dmg,m.t)}
  else{log(L(`${d.nom} verfehlt dich.`,`${d.nom} misses you.`),'dim');SFX.miss()}
}
function die(cause){if(!G.alive)return;G.alive=false;G.cause=cause;log(L('Lebenszeichen erloschen.','Life signs lost.'),'hurt');SFX.die();finish()}
function useAction(){G.p.act=0;if(G.p.invis>0){G.p.invis=0;log(L('Der Angriff verrät dich. Tarnfeld weg.','The attack gives you away. Cloak field gone.'),'warn')}}
function afterAction(){G.mons=G.mons.filter(m=>m.hp>0);computeVis();checkClear();updateUI();autoEnd()}

function melee(m){
  if(G.p.act<=0){log(ACTION_USED(),'dim');updateUI();return}
  const d=MON[m.t],amb=ambush();useAction();
  if(rnd()<.9){const dmg=Math.max(1,atk()+ri(-1,1)-d.def)*amb;log(L(`Du triffst ${d.acc}: ${dmg} Schaden.`,`You hit ${d.acc}: ${dmg} damage.`));SFX.hit();hitMon(m,dmg)}
  else{log(L(`Du verfehlst ${d.acc}.`,`You miss ${d.acc}.`),'dim');SFX.miss();m.aware=true;m.known={x:G.p.x,y:G.p.y}}
  afterAction();
}
/* Hinterhalt der Späherin: doppelter Schaden, solange das Tarnfeld beim Angriff noch steht. */
const ambush=()=>G.cls==='scout'&&unl(2)&&G.p.invis>0?2:1;
const canShoot=()=>G.p.ammo>0||!!CLS[G.cls].side;
const shootable=m=>m.hp>0&&VIS[m.x+m.y*RW]&&cheb(m,G.p)<=7;
function shootTargets(){return G.mons.filter(shootable).sort((a,b)=>cheb(a,G.p)-cheb(b,G.p))}
function shootAt(m){
  const p=G.p;if(p.act<=0){log(ACTION_USED(),'dim');updateUI();return}
  if(!canShoot()){log(L('Keine Munition. Energiezellen laden den Blaster.','No ammo. Energy cells reload the blaster.'),'warn');updateUI();return}
  /* Ohne Munition greift die Späherin zur Nadelpistole: unbegrenzt, aber nur halb so stark. */
  const side=p.ammo<=0,weak=side&&!unl(0),amb=ambush();useAction();if(!side)p.ammo--;G.target=null;
  fx.push({type:'line',a:{x:p.x,y:p.y},b:{x:m.x,y:m.y},col:side?'#9aa6b2':'#5fd3e6',t0:performance.now(),dur:180});SFX.shoot();
  const d=MON[m.t];
  if(rnd()<.85){const dmg=Math.max(1,(weak?2:4+Math.floor(p.lvl/2))+ri(0,weak?1:2)-Math.floor(d.def/2))*amb;log(L(`${side?CLS[G.cls].side:'Blaster'} trifft ${d.acc}: ${dmg} Schaden.`,`${side?CLS[G.cls].side:'Blaster'} hits ${d.acc}: ${dmg} damage.`));hitMon(m,dmg)}
  else{log(L(`Der Schuss verfehlt ${d.acc}.`,`The shot misses ${d.acc}.`),'dim');m.aware=true;m.known={x:p.x,y:p.y}}
  afterAction();
}
function fireButton(quick){
  if(!canInput())return;
  if(G.target){G.target=null;updateUI();return}
  if(!inCombat()){log(L('Hier gibt es nichts mehr zu beschießen.','Nothing left to shoot here.'),'dim');updateUI();return}
  const p=G.p;
  if(p.act<=0){log(ACTION_USED(),'dim');updateUI();return}
  if(!canShoot()){log(L('Keine Munition.','No ammo.'),'warn');updateUI();return}
  const ts=shootTargets();
  if(!ts.length){log(L('Kein Gegner in Sicht und Reichweite (7 Felder).','No enemy in sight and range (7 tiles).'),'dim');updateUI();return}
  if(ts.length===1||quick){shootAt(ts[0]);return}
  G.target={kind:'shoot'};log(L('Ziel wählen: klicke auf einen markierten Gegner. Esc bricht ab.','Choose a target: click a marked enemy. Esc cancels.'),'dim');updateUI();
}
function ability(){
  if(!canInput())return;const p=G.p,c=CLS[G.cls];
  if(!inCombat()){log(L('Fähigkeiten nur im Kampf.','Abilities only in combat.'),'dim');updateUI();return}
  if(p.cd>0){log(L(`${c.ab} lädt noch ${rounds_(p.cd)}.`,`${c.ab} recharges for ${rounds_(p.cd)}.`),'dim');updateUI();return}
  if(p.act<=0){log(ACTION_USED(),'dim');updateUI();return}
  if(G.cls==='marine'){
    const adj=G.mons.filter(m=>m.hp>0&&cheb(m,p)===1&&VIS[m.x+m.y*RW]);
    if(!adj.length){log(L('Kein Gegner direkt neben dir.','No enemy right next to you.'),'dim');updateUI();return}
    useAction();log(L('Sperrfeuer!','Barrage!'),'info');SFX.shoot();
    adj.forEach(m=>{const d=MON[m.t];const dmg=Math.max(1,atk()+3-d.def);fx.push({type:'line',a:{x:p.x,y:p.y},b:{x:m.x,y:m.y},col:'#ffb000',t0:performance.now(),dur:180});log(L(`${d.nom} nimmt ${dmg} Schaden.`,`${d.nom} takes ${dmg} damage.`));hitMon(m,dmg)});
  }else if(G.cls==='tech'){
    const vis=G.mons.filter(m=>m.hp>0&&VIS[m.x+m.y*RW]);
    if(!vis.length){log(L('Kein Gegner in Sicht.','No enemy in sight.'),'dim');updateUI();return}
    useAction();log(L('EMP-Impuls! Alles in Sicht erstarrt.','EMP pulse! Everything in sight freezes.'),'info');SFX.emp();
    fx.push({type:'ring',x:p.x,y:p.y,t0:performance.now(),dur:450});
    vis.forEach(m=>{const d=MON[m.t];m.stun=Math.max(m.stun,d.boss?1:unl(1)?3:2);if(d.robot)hitMon(m,6)});
  }else{
    p.act=0;p.invis=unl(1)?3:2;G.mons.forEach(m=>{m.known=null});log(L('Tarnfeld aktiv. Die Gegner verlieren deine Spur.','Cloak field active. The enemies lose your trail.'),'info');SFX.emp();
  }
  p.cd=abCd()+1;afterAction();
}
function ability2(){
  if(!canInput())return;const p=G.p,a=AB2[G.cls];
  if(!a||!unl(2))return;
  if(!inCombat()){log(L('Fähigkeiten nur im Kampf.','Abilities only in combat.'),'dim');updateUI();return}
  if(p.cd2>0){log(L(`${a.n} lädt noch ${rounds_(p.cd2)}.`,`${a.n} recharges for ${rounds_(p.cd2)}.`),'dim');updateUI();return}
  if(p.act<=0){log(ACTION_USED(),'dim');updateUI();return}
  if(G.cls==='marine'){G.target={kind:'nade',ab:1};log(L('Splittergranate: klicke auf ein Zielfeld (bis 5 Felder, freie Sicht). Esc bricht ab.','Frag grenade: click a target tile (up to 5 tiles, clear line of sight). Esc cancels.'),'dim');updateUI();return}
  useAction();p.shield=2;p.cd2=a.cd+1;log(L('Schildgenerator aktiv. Gegner richten 2 Runden keinen Schaden an.','Shield generator active. Enemies deal no damage for 2 rounds.'),'info');SFX.emp();afterAction();
}

/* ---------- Items ---------- */
function pickup(){
  const p=G.p,it=itemAt(p.x,p.y);if(!it)return;const d=IT[it.k];
  if(it.k==='cell'){p.ammo+=4;G.items.splice(G.items.indexOf(it),1);log(L('Energiezelle: +4 Munition.','Energy cell: +4 ammo.'),'good');SFX.pick();return}
  if(p.inv.length>=INV){log(L(`${d.n} liegt hier. Inventar voll: Leg ein Item mit ✕ ab, dann tauschst du direkt.`,`${d.n} lies here. Inventory full: drop an item with ✕ to swap directly.`),'warn');return}
  p.inv.push(it.k);G.items.splice(G.items.indexOf(it),1);log(L(`Aufgenommen: ${d.n}.`,`Picked up: ${d.n}.`),'good');SFX.pick();
}
function useItem(idx){
  if(!canInput())return;const p=G.p,k=p.inv[idx];if(!k)return;const d=IT[k];
  if(G.target){G.target=null}
  const combat=inCombat();
  if(combat&&p.act<=0){log(L('Deine Aktion ist schon verbraucht. Items gibt es nächste Runde.','Your action is already used up. Items next round.'),'dim');updateUI();return}
  if(k==='nade'){
    if(!combat){log(L('Kein Ziel. Die Granate bleibt im Gürtel.','No target. The grenade stays on your belt.'),'dim');updateUI();return}
    G.target={kind:'nade',slot:idx};log(L('Granate: klicke auf ein Zielfeld (bis 5 Felder, freie Sicht). Esc bricht ab.','Grenade: click a target tile (up to 5 tiles, clear line of sight). Esc cancels.'),'dim');updateUI();return;
  }
  if(d.slot){const old=p[d.slot];p[d.slot]=k;p.inv.splice(idx,1);if(old)p.inv.push(old);log(L(`Ausgerüstet: ${d.n}.`,`Equipped: ${d.n}.`),'info');SFX.pick();
    if(combat){p.act=0;afterAction()}else updateUI();return}
  switch(k){
    case'med':{if(p.hp>=p.max){log(L('Du bist unverletzt.','You are unhurt.'),'dim');updateUI();return}const h=Math.min(12,p.max-p.hp);
      // Bestätigen = gleich als nächste Eingabe nochmal wählen (ohne Uhrzeit, damit der Server den Run genau nachspielen kann)
      const ma=G.medArm,seq=G.rec?G.rec.length:0;
      if(h<12&&!(ma&&ma.idx===idx&&ma.seq===seq-1)){G.medArm={idx,seq};log(L(`Injektion heilt jetzt nur ${h} von 12 TP. Zum Bestätigen nochmal wählen (Taste ${idx+1}).`,`The injection would only heal ${h} of 12 HP right now. Select it again to confirm (key ${idx+1}).`),'warn');updateUI();return}
      G.medArm=null;p.hp+=h;log(L(`Injektion: +${h} TP.`,`Injection: +${h} HP.`),'good');SFX.pick();break}
    case'stim':if(!combat){log(L('Spar dir das Stimulans für den Kampf.','Save the stim for a fight.'),'dim');updateUI();return}p.stim=3;log(L('Kampfstimulans: Angriff +3 für 3 Runden.','Combat stim: attack +3 for 3 rounds.'),'info');SFX.pick();break;
    case'scan':if(!combat){log(L('Der Melder zeigt nichts. Der Raum ist leer.','The tracker shows nothing. The room is empty.'),'dim');updateUI();return}
      G.mons.forEach(m=>{if(m.hp>0){m.gx=m.x;m.gy=m.y}});log(L('Bewegungsmelder: alle Gegner markiert.','Motion tracker: all enemies marked.'),'info');SFX.emp();break;
    case'phase':{if(!combat){log(L('Kein Grund zu fliehen.','No reason to run.'),'dim');updateUI();return}
      let best=[],bd=-1;
      for(let i=0;i<RW*RH;i++){if(G.map[i]!==FLOOR)continue;const x=i%RW,y=(i/RW)|0;if(monAt(x,y)||itemAt(x,y))continue;
        const md=Math.min(99,...G.mons.filter(m=>m.hp>0).map(m=>cheb(m,{x,y})));if(md>bd){bd=md;best=[[x,y]]}else if(md===bd)best.push([x,y])}
      const[x,y]=best[Math.floor(rnd()*best.length)];p.x=x;p.y=y;G.mons.forEach(m=>{if(!canSee(m))m.known=null});
      log(L('Phasensprung. Dir ist übel, aber du bist weg.','Phase jump. You feel sick, but you are gone.'),'info');SFX.emp();break}
  }
  p.inv.splice(idx,1);
  if(combat){p.act=0;afterAction()}else{computeVis();updateUI()}
}
/* Ablegen kostet keine Aktion. Liegt schon etwas unter dir, wird getauscht. */
function dropItem(idx){
  if(!canInput())return;const p=G.p,k=p.inv[idx];if(!k)return;
  G.target=null;
  const here=itemAt(p.x,p.y);
  p.inv.splice(idx,1);
  if(here){
    G.items.splice(G.items.indexOf(here),1);
    p.inv.push(here.k);
    log(L(`Getauscht: ${IT[k].n} abgelegt, ${IT[here.k].n} aufgenommen.`,`Swapped: dropped ${IT[k].n}, picked up ${IT[here.k].n}.`),'info');SFX.pick();
  }else log(L(`Abgelegt: ${IT[k].n}. Klick auf dein Feld oder G hebt es wieder auf.`,`Dropped: ${IT[k].n}. Click your tile or press G to pick it up again.`),'info');
  G.items.push({k,x:p.x,y:p.y});SFX.drop();
  updateUI();
}
function pickupHere(){
  if(!canInput())return;
  if(!itemAt(G.p.x,G.p.y)){log(L('Hier liegt nichts.','Nothing here.'),'dim');updateUI();return}
  pickup();updateUI();
}
function throwNade(tx,ty){
  const p=G.p,{slot,ab}=G.target;G.target=null;
  if(ab)p.cd2=AB2.marine.cd+1;
  else{if(p.inv[slot]!=='nade'){updateUI();return}p.inv.splice(slot,1)}
  useAction();
  fx.push({type:'line',a:{x:p.x,y:p.y},b:{x:tx,y:ty},col:'#8bdc5f',t0:performance.now(),dur:200});
  fx.push({type:'boom',x:tx,y:ty,t0:performance.now(),dur:400});SFX.boom();log(L('Splittergranate!','Frag grenade!'),'info');
  G.mons.filter(m=>m.hp>0&&Math.abs(m.x-tx)<=1&&Math.abs(m.y-ty)<=1).forEach(m=>{const dmg=Math.max(1,8-Math.floor(MON[m.t].def/2));log(L(`${mName(m)} nimmt ${dmg} Schaden.`,`${mName(m)} takes ${dmg} damage.`));hitMon(m,dmg)});
  if(Math.abs(p.x-tx)<=1&&Math.abs(p.y-ty)<=1){log(L('Splitter treffen dich: 4 Schaden.','Shrapnel hits you: 4 damage.'),'hurt');hurtPlayer(4,'nade')}
  if(G.alive)afterAction();else updateUI();
}
const nadeOk=(x,y)=>G.map[x+y*RW]===FLOOR&&VIS[x+y*RW]&&cheb({x,y},G.p)<=5;

/* ---------- Bewegung ---------- */
async function walk(path,then){
  busy=true;hover=null;const run=G;
  for(const i of path){
    if(G!==run||!live()){then=null;break}   // Run abgebrochen oder neuer Run: nicht weiterlaufen
    const x=i%RW,y=(i/RW)|0;
    const m=monAt(x,y);
    if(m){computeVis();log(L(`Hinterhalt! ${mName(m)} versperrt den Weg.`,`Ambush! ${mName(m)} blocks the way.`),'warn');m.gx=m.x;m.gy=m.y;then=null;break}
    G.p.x=x;G.p.y=y;if(G.phase==='player')G.p.mp--;SFX.step();
    pickup();computeVis();updateUI();await sleep(80);
  }
  if(G!==run)return;
  busy=false;computeVis();updateUI();
  if(!live())return;
  if(then)then();else autoEnd();
}
function stepPlayer(dx,dy){
  if(!canInput())return;const p=G.p;
  if(G.target){G.target=null}
  if(!dx&&!dy){if(inCombat())endTurn();return}
  const nx=p.x+dx,ny=p.y+dy;
  const m=monAt(nx,ny);
  if(m&&inCombat()){
    if(dx&&dy&&solidT(G.map[p.x+ny*RW])&&solidT(G.map[nx+p.y*RW])){log(L('Die Ecke ist im Weg.','The corner is in the way.'),'dim');updateUI();return}
    m.gx=m.x;m.gy=m.y;melee(m);return}
  const t=G.map[nx+ny*RW];
  if(G.phase==='explore'&&(t===EXIT||(t===POD&&G.bossDead))&&!(dx&&dy)){goThrough(nx,ny);return}
  if(!canStep(G.map,p.x,p.y,nx,ny))return;
  if(inCombat()&&p.mp<=0){log(L('Keine Bewegung mehr. Nutze deine Aktion oder beende den Zug.','No movement left. Use your action or end your turn.'),'dim');updateUI();return}
  p.x=nx;p.y=ny;if(inCombat())p.mp--;SFX.step();
  pickup();computeVis();updateUI();autoEnd();
}
function tileClick(tx,ty){
  if(!canInput())return;const p=G.p;
  if(tx<0||ty<0||tx>=RW||ty>=RH)return;
  if(G.target){
    if(G.target.kind==='shoot'){const m=visMonAt(tx,ty);if(m&&shootable(m))shootAt(m);else{G.target=null;log(AIM_CANCEL(),'dim');updateUI()}return}
    if(G.target.kind==='nade'){if(nadeOk(tx,ty))throwNade(tx,ty);else{G.target=null;log(AIM_CANCEL(),'dim');updateUI()}return}
  }
  const m=visMonAt(tx,ty);
  if(m){
    if(!inCombat())return;
    if(cheb(m,p)===1){melee(m);return}
    if(p.act<=0){log(ACTION_USED(),'dim');updateUI();return}
    if(shootable(m)&&canShoot()){shootAt(m);return}
    log(!canShoot()?L('Keine Munition. Lauf hin und kämpf im Nahkampf.','No ammo. Walk over and fight in melee.'):L(`${MON[m.t].nom} ist zu weit weg (max. 7 Felder).`,`${MON[m.t].nom} is too far away (max. 7 tiles).`),'dim');updateUI();return;
  }
  const t=G.map[tx+ty*RW];
  if(G.phase==='explore'&&(t===EXIT||(t===POD&&G.bossDead))){
    const nb=D8.slice(0,4).map(([dx,dy])=>[tx+dx,ty+dy]).find(([x,y])=>x>0&&y>0&&x<RW-1&&y<RH-1&&G.map[x+y*RW]===FLOOR);
    if(!nb)return;const i=nb[0]+nb[1]*RW;
    if(i===p.x+p.y*RW){goThrough(tx,ty);return}
    if(REACH[i]<0)return;walk(pathTo(i),()=>goThrough(tx,ty));return;
  }
  if(t===POD&&!G.bossDead){log(L('Die Kapsel ist verriegelt, solange die Brutmutter lebt.','The pod stays locked while the Brood Mother lives.'),'warn');updateUI();return}
  if(t===DOOR){log(G.phase==='explore'?L('Diese Tür bleibt verriegelt.','This door stays locked.'):L('Verriegelt. Erst muss der Raum sauber sein.','Locked. Clear the room first.'),'dim');updateUI();return}
  const i=tx+ty*RW;
  if(i===p.x+p.y*RW){if(itemAt(tx,ty))pickupHere();return}
  if(REACH[i]<0){if(t===FLOOR&&inCombat())log(L(`Zu weit. Du hast noch ${p.mp} Feld${p.mp===1?'':'er'} Bewegung.`,`Too far. You have ${p.mp} tile${p.mp===1?'':'s'} of movement left.`),'dim');updateUI();return}
  walk(pathTo(i));
}

/* ---------- Raum gesichert & Türen ---------- */
function checkClear(){
  if(G.phase!=='player'||G.mons.some(m=>m.hp>0))return;
  G.phase='explore';G.cleared++;G.mons=[];G.target=null;const p=G.p;
  const heal=Math.min(3,p.max-p.hp);p.hp+=heal;
  G.exits.forEach(e=>{const t=sideTile(e.side,e.pos);G.map[t.x+t.y*RW]=EXIT});
  if(G.boss){log(L('Raum gesichert. Die Rettungskapsel ist entriegelt. Steig ein!','Room secured. The escape pod is unlocked. Get in!'),'good');banner(L('Kapsel entriegelt','Pod unlocked'),'good');SFX.win()}
  else{log(L(`Raum gesichert in ${rounds_(G.round)}.${heal?` Atempause: +${heal} TP.`:''}${G.items.length?' Vergiss die Beute nicht.':''}`,
             `Room secured in ${rounds_(G.round)}.${heal?` Breather: +${heal} HP.`:''}${G.items.length?' Don’t forget the loot.':''}`),'good');
    log(G.exits.length>1?L(`${G.exits.length} Türen öffnen sich. Wähle eine. Was dahinter liegt, weiß niemand.`,`${G.exits.length} doors open. Pick one. Nobody knows what lies behind them.`)
      :L('Eine schwere Schleuse öffnet sich. Dahinter: die Brutkammer.','A heavy airlock opens. Behind it: the brood chamber.'),'info');
    banner(L('Raum gesichert','Room secured'),'good');SFX.lvl()}
  computeVis();
}
function goThrough(x,y){
  const t=G.map[x+y*RW];
  if(t===POD){G.p.x=x;G.p.y=y;G.win=true;log(L('Kapsel abgekoppelt. Die IKARUS-7 schrumpft hinter dir zu einem Punkt.','Pod undocked. The IKARUS-7 shrinks to a dot behind you.'),'good');SFX.win();finish();return}
  const e=G.exits.find(e=>{const s=sideTile(e.side,e.pos);return s.x===x&&s.y===y});if(!e)return;
  G.path+=e.side+e.pos+'.';SFX.lift();
  enterRoom(G.room+1,OPP[e.side]);
}

/* ---------- Gegner-KI ---------- */
function distTo(tx,ty,self){
  const d=new Int16Array(RW*RH).fill(-1);d[tx+ty*RW]=0;const q=[tx+ty*RW];let qi=0;
  const block=(x,y)=>{const o=monAt(x,y);return o&&o!==self};
  while(qi<q.length){const i=q[qi++],x=i%RW,y=(i/RW)|0;
    for(const[dx,dy]of D8){const nx=x+dx,ny=y+dy;if(!canStep(G.map,x,y,nx,ny))continue;const j=nx+ny*RW;if(d[j]>=0||block(nx,ny))continue;d[j]=d[i]+1;q.push(j)}}
  return d;
}
function freeFor(m,x,y){return canStep(G.map,m.x,m.y,x,y)&&!monAt(x,y)&&!(x===G.p.x&&y===G.p.y)}
async function monTurn(m){
  const d=MON[m.t],p=G.p,run=G,gone=()=>G!==run;
  const shown=()=>VIS[m.x+m.y*RW];
  if(m.stun>0){m.stun--;if(shown()){log(L(`${d.nom} ist gelähmt.`,`${d.nom} is stunned.`),'dim');await sleep(250)}return}
  if(m.spit>0)m.spit--;
  let sees=canSee(m);
  const notice=()=>{if(!m.aware){m.aware=true;if(shown())log(L(`${d.nom} entdeckt dich!`,`${d.nom} spots you!`),'warn')}m.known={x:p.x,y:p.y}};
  if(sees)notice();
  if(d.boss&&m.aware){
    m.spawn++;
    if(m.spawn%3===0&&G.mons.filter(o=>o.t==='larva'&&o.hp>0).length<4){
      const spots=D8.map(([dx,dy])=>[m.x+dx,m.y+dy]).filter(([x,y])=>freeFor(m,x,y));
      if(spots.length){const[x,y]=spots[Math.floor(rnd()*spots.length)];const l=newMon('larva',x,y);l.aware=true;l.known={x:p.x,y:p.y};G.mons.push(l);
        computeVis();if(shown())log(L('Die Brutmutter stößt eine Larve aus.','The Brood Mother expels a larva.'),'warn');await sleep(350);return}
    }
  }
  if(!m.known)return;
  const attack=async()=>{
    if(!sees)return false;
    if(cheb(m,p)===1&&!d.nomelee){if(shown())await sleep(150);if(gone())return true;monAttack(m,mAtk(m),'hit');await sleep(300);return true}
    if(d.range&&cheb(m,p)<=d.range&&(!d.boss||(cheb(m,p)>1&&m.spit<=0))){
      fx.push({type:'line',a:{x:m.x,y:m.y},b:{x:p.x,y:p.y},col:d.boss?'#8bdc5f':'#ff4d3d',t0:performance.now(),dur:240});
      if(d.boss){m.spit=2;SFX.spit();monAttack(m,6,'spit')}else{SFX.zap();monAttack(m,mAtk(m),'shoot')}
      await sleep(320);return true;
    }
    return false;
  };
  if(await attack()||gone())return;
  if(!G.alive)return;
  for(let s=0;s<d.mp;s++){
    if(sees&&cheb(m,p)===1)break;
    if(!sees&&m.x===m.known.x&&m.y===m.known.y)break;
    if(sees&&d.range&&!d.boss&&cheb(m,p)<=d.range)break;
    const dist=distTo(m.known.x,m.known.y,m);
    let best=null,bv=dist[m.x+m.y*RW];if(bv<0)bv=999;
    for(const[dx,dy]of D8){const nx=m.x+dx,ny=m.y+dy;if(!freeFor(m,nx,ny))continue;const v=dist[nx+ny*RW];if(v>=0&&v<bv){bv=v;best=[nx,ny]}}
    if(!best)break;
    const wasShown=shown();
    m.x=best[0];m.y=best[1];computeVis();
    if(wasShown||shown()){emit('sfx','move',m.t);updateUI();await sleep(130);if(gone())return}
    sees=canSee(m);if(sees)notice();
  }
  if(await attack())return;
  if(!sees&&m.known&&cheb(m,m.known)<=1){m.known=null;if(shown())log(L(`${d.nom} hat deine Spur verloren.`,`${d.nom} has lost your trail.`),'dim')}
}

const unl=i=>lp(G.cls)>=UNL[i];
let lastEntry=null;
function saveRun(){if(timing.save)storeRun(G&&screen==='game'&&!G.over?{G,screen,sel}:null)}
function finish(){
  if(finishing)return;finishing=true;G.over=true;busy=false;
  const entry={id:Date.now(),score:score(),cls:G.cls,seed:G.seed,day:G.day||null,room:G.room,win:G.win,rounds:G.rounds,kills:G.kills,lvl:G.p.lvl,cause:G.cause,xp:G.xpTotal,cleared:G.cleared,quit:!!G.quit};
  // Abgebrochene Runs zählen nicht für die Bestenliste. Aufzeichnung (rec, lp0) nur für das Eintragen, nicht im Browser speichern.
  lastEntry={...entry,rec:G.rec||null,lp0:G.lp0};if(!entry.quit)saveScore(entry);updateUI();
  later(()=>{if(G&&G.over)showScreen('end')},G.win?900:1200);
}

/* ---------- Zusätzliche Einstiege für Oberfläche und Tests ---------- */
function cancelTarget(){if(G&&G.target){G.target=null;log(AIM_CANCEL(),'dim');updateUI()}}
function quitRun(){if(G&&!G.over){G.alive=false;G.quit=true;G.cause='quit';log(L('Einsatz abgebrochen.','Mission abandoned.'),'warn');finish()}}
/* Gespeicherten Run prüfen: Er kommt aus dem Browserspeicher und kann veraltet, beschädigt oder verändert sein.
   Alles, was Logik und Darstellung später ungeprüft benutzen, muss hier die richtige Form haben. */
const isInt=(v,a,b)=>Number.isInteger(v)&&v>=a&&v<=b;
const isNum=v=>typeof v==='number'&&isFinite(v);
const onMap=o=>o&&isInt(o.x,0,RW-1)&&isInt(o.y,0,RH-1);
function validRun(data){
  try{
    if(!data||data.screen!=='game')return false;
    const G=data.G;if(!G||typeof G!=='object')return false;
    if(typeof G.seed!=='string'||!/^[A-Z0-9]{1,10}$/.test(G.seed)||!CLS[G.cls])return false;
    if(G.alive!==true||G.over||!isInt(G.room,1,ROOMS)||!['player','enemy','explore'].includes(G.phase))return false;
    if(!Array.isArray(G.map)||G.map.length!==RW*RH||!G.map.every(t=>isInt(t,0,POD)))return false;
    if(!Array.isArray(G.deco)||G.deco.length!==RW*RH||!G.deco.every(isNum))return false;
    for(const k of ['round','rounds','kills','xpTotal','cleared','nid'])if(!isInt(G[k],0,1e6))return false;
    if(!isNum(G.rs)||typeof G.path!=='string'||G.path.length>200)return false;
    if(!Array.isArray(G.mons)||!G.mons.every(m=>m&&MON[m.t]&&onMap(m)&&isNum(m.hp)&&isNum(m.max)&&isInt(m.id,0,1e6)))return false;
    if(!Array.isArray(G.items)||!G.items.every(i=>i&&IT[i.k]&&onMap(i)))return false;
    if(!Array.isArray(G.exits)||!G.exits.every(e=>e&&['L','R','T','B'].includes(e.side)&&isInt(e.pos,0,RW)))return false;
    if(!Array.isArray(G.log)||!G.log.every(l=>l&&typeof l.t==='string'&&typeof l.k==='string'))return false;
    const p=G.p;if(!onMap(p))return false;
    for(const k of ['hp','max','atk','def','lvl','xp','ammo','mp','act','cd','cd2','shield','invis','stim'])if(!isNum(p[k]))return false;
    if(!Array.isArray(p.inv)||p.inv.length>INV||!p.inv.every(k=>IT[k]))return false;
    if((p.wpn&&!(IT[p.wpn]&&IT[p.wpn].slot==='wpn'))||(p.arm&&!(IT[p.arm]&&IT[p.arm].slot==='arm')))return false;
    if(G.offer!=null&&!(Array.isArray(G.offer)&&G.offer.every(k=>PERKS[k])))return false;
    if(G.target!=null&&!(typeof G.target==='object'&&['shoot','nade'].includes(G.target.kind)))return false;
    if(G.rec!=null&&!Array.isArray(G.rec))return false;
    if(G.medArm!=null&&!(isInt(G.medArm.idx,0,INV-1)&&isInt(G.medArm.seq,0,1e7)))return false;
    return true;
  }catch(e){return false}
}
/* Gespeicherten Run fortsetzen. Gibt true zurück, wenn es geklappt hat; ein ungültiger Run wird verworfen.
   Der Prüfwert des geladenen Stands kommt als Ereignis R in die Aufzeichnung, damit der Server beim Nachspielen
   genau an dieser Stelle ebenfalls „neu lädt“ (dort entsteht derselbe Stand). */
function restore(data){
  if(!validRun(data)){if(data)storeRun(null);return false}
  G=data.G;if(data.sel&&CLS[data.sel])sel=data.sel;finishing=false;busy=false;pendingEnd=false;hover=null;
  if(G.rec)G.rec.push(['R',runHash(G),lp(G.cls)]);
  showScreen('game');
  // Im Gegnerzug gespeichert: Die Gegner ziehen komplett neu, sonst ließe sich ihr Zug durch Neuladen überspringen
  if(G.phase==='enemy'){G.active=null;enemyPhase()}else{computeVis();updateUI();autoEnd()}
  return true;
}
/* Prüfwert eines Spielstands. Ohne Log und Raumnamen: Die hängen von der Sprache ab, nicht vom Spielverlauf. */
const runHash=g=>{const {log,name,...rest}=g;const s=JSON.stringify(rest);return h32(s).toString(36)+'.'+s.length};

/* ---------- Aufzeichnung der Eingaben ----------
   Jede Eingabe, die angenommen wird, landet in G.rec: [Kürzel, Runden gesamt, Phase p/x, Argumente…].
   Der Server spielt den Run damit nach (core/replay.js) und trägt nur ein, was dabei herauskommt.
   Interne Aufrufe (z. B. stepPlayer → endTurn, automatisches Zugende) werden nicht aufgezeichnet. */
const recArg=v=>typeof v==='boolean'?+v:v;
function rec(code,args){if(G&&G.rec)G.rec.push([code,G.rounds,G.phase==='explore'?'x':'p',...args.map(recArg)])}
const recorded=(code,ok,fn)=>(...a)=>{if(ok(...a))rec(code,a);return fn(...a)};
const okInput=()=>canInput();
const ACTIONS={
  s:recorded('s',okInput,stepPlayer),
  c:recorded('c',(x,y)=>canInput()&&x>=0&&y>=0&&x<RW&&y<RH,tileClick),
  f:recorded('f',okInput,fireButton),
  a:recorded('a',okInput,ability),
  b:recorded('b',okInput,ability2),
  u:recorded('u',okInput,useItem),
  d:recorded('d',okInput,dropItem),
  g:recorded('g',okInput,pickupHere),
  p:recorded('p',i=>!!(G&&G.offer&&G.offer[i]&&live()),takePerk),
  e:recorded('e',()=>live()&&!busy&&!G.offer&&G.phase==='player',endTurn),
  x:recorded('x',()=>!!(G&&G.target&&live()),cancelTarget),
};

const setScreen=s=>{screen=s};
const setSel=k=>{if(CLS[k])sel=k};
const setHover=h=>{hover=h};

/* Lesender Zugriff auf den Zustand für Darstellung und Oberfläche */
const S={
  get G(){return G},get VIS(){return VIS},get REACH(){return REACH},get PARENT(){return PARENT},
  get screen(){return screen},get sel(){return sel},get busy(){return busy},get hover(){return hover},
  get hurtT(){return hurtT},get lastEntry(){return lastEntry},
};

/* Nach außen nur die aufgezeichneten Fassungen der Eingaben */
const {s:stepPlayer_,c:tileClick_,f:fireButton_,a:ability_,b:ability2_,u:useItem_,d:dropItem_,g:pickupHere_,p:takePerk_,e:endTurn_,x:cancelTarget_}=ACTIONS;
export {S,timing,PERKS,ACTIONS,runHash,
  startRun,enterRoom,startRound,
  endTurn_ as endTurn,stepPlayer_ as stepPlayer,tileClick_ as tileClick,fireButton_ as fireButton,ability_ as ability,ability2_ as ability2,
  useItem_ as useItem,dropItem_ as dropItem,pickupHere_ as pickupHere,takePerk_ as takePerk,cancelTarget_ as cancelTarget,
  quitRun,restore,validRun,setScreen,setSel,setHover,computeVis,updateUI,
  atk,def,need,dodge,abCd,score,live,canInput,inCombat,monAt,visMonAt,itemAt,canSee,canShoot,shootable,shootTargets,nadeOk,pathTo,unl,lp};
