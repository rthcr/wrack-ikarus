// Konstanten und Datentabellen von Wrack Ikarus.
// Aus der klassischen Version übernommen, Inhalt unverändert. Englische Namen und Texte stehen unten in EN.
import {L,localize} from './i18n.js';

const RW=17,RH=13,T=8,ROOMS=9,INV=6;
const WALL=0,FLOOR=1,BLOCK=2,DOOR=3,EXIT=4,POD=5;
const D8=[[1,0],[-1,0],[0,1],[0,-1],[1,1],[1,-1],[-1,1],[-1,-1]];
const OPP={L:'R',R:'L',T:'B',B:'T'};
const TIERNAME=['Frachtdeck','Wohnbereich','Reaktorring','Brutkammer'];
const ROOMNAMES={1:['Frachtschleuse','Containerlager','Ladebucht','Wartungsschacht','Ersatzteillager'],2:['Kantine','Schlafkojen','Krankenstation','Hydrokulturbecken','Labor B','Freizeitmodul'],3:['Reaktorsteuerung','Kühlmittelpumpen','Waffenkammer','Funkraum','Turbinenhalle']};
const FLOORTINT=['#1a222c','#17231f','#271e1a','#211a28'];
const ALPH='ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
const tierOf=i=>i>=ROOMS?4:i<=3?1:i<=6?2:3;

/* Die Pixel-Art liegt in src/render/art.js. */

const CLS={
 marine:{n:'Marine',hp:30,atk:4,def:1,ammo:6,mp:3,dodge:0,ab:'Sperrfeuer',abd:'trifft alle angrenzenden Gegner mit Angriff +3. Abklingzeit 3 Runden.',cd:3,inv:['med'],gear:'Start: Medi-Injektor, 6 Schuss',col:{h:'#8f9a3e',H:'#545b22'}},
 tech:{n:'Technikerin',hp:22,atk:3,def:1,ammo:4,mp:3,dodge:0,ab:'EMP-Impuls',abd:'lähmt alle sichtbaren Gegner 2 Runden, Maschinen nehmen 6 Schaden. Abklingzeit 4 Runden.',cd:4,inv:['med','scan'],gear:'Start: Medi-Injektor, Bewegungsmelder, 4 Schuss',col:{h:'#d7dde3',H:'#7f8b97'}},
 eng:{n:'Ingenieur',hp:24,atk:3,def:1,ammo:4,mp:3,dodge:0,ab:'Geschütz',abd:'stellt ein Geschütz neben dich. Es schießt 4 Runden lang jede Runde auf den nächsten Gegner in seiner Sicht (bis 6 Felder). Abklingzeit 5 Runden.',cd:5,inv:['med','mine'],gear:'Start: Medi-Injektor, Annäherungsmine, 4 Schuss',col:{h:'#e0b040',H:'#8a6412'}},
 scout:{n:'Späherin',hp:20,atk:3,def:0,ammo:5,mp:4,dodge:.15,ab:'Tarnfeld',abd:'2 Runden unsichtbar, Gegner verlieren deine Spur. 4 Felder Bewegung, weicht 15 % aus.',cd:4,inv:['med','phase'],side:'Nadelpistole',gear:'Start: Medi-Injektor, Phasenkapsel, 5 Schuss, Nadelpistole (ohne Munition, schwach)',col:{h:'#d9644a',H:'#7d3020'}}
};
/* Dauerhafte Freischaltungen pro Klasse: LP sind alle EP, die je mit der Klasse gesammelt wurden. */
const UNL=[100,300,600];
const UNLD={
 marine:['Startet mit +5 TP','Sperrfeuer: Abklingzeit 2','Splittergranate (T): 8 Schaden im 3×3-Feld, bis 5 Felder, Abklingzeit 4'],
 tech:['Startet mit einer Energiezelle (+4 Munition)','EMP lähmt 3 Runden','Schildgenerator (T): 2 Runden kein Schaden durch Gegner, Abklingzeit 5'],
 scout:['Nadelpistole macht vollen Schaden','Tarnfeld hält 3 Runden','Hinterhalt: Angriff aus der Tarnung macht doppelten Schaden'],
 eng:['Startet mit einer Splittergranate','Geschütz richtet +2 Schaden an','Geschütz bleibt bis zum Ende des Kampfes stehen']};
const AB2={marine:{n:'Splittergranate',cd:4},tech:{n:'Schildgenerator',cd:5}};
/* Upgrades beim Stufenaufstieg: 3 zufällige zur Wahl, gelten bis Run-Ende. */
const MON={
 larva:{nom:'Die Larve',acc:'die Larve',n:'Larve',hp:4,atk:2,def:0,mp:3,xp:2},
 drone:{nom:'Die Wartungsdrohne',acc:'die Wartungsdrohne',n:'Wartungsdrohne',hp:7,atk:3,def:1,mp:3,xp:3,robot:1},
 mutant:{nom:'Der mutierte Techniker',acc:'den mutierten Techniker',n:'Mutierter Techniker',hp:12,atk:4,def:1,mp:2,xp:5},
 turret:{nom:'Der Geschützturm',acc:'den Geschützturm',n:'Geschützturm',hp:9,atk:3,def:2,mp:0,xp:5,robot:1,range:6,nomelee:1},
 hunter:{nom:'Der Xeno-Jäger',acc:'den Xeno-Jäger',n:'Xeno-Jäger',hp:13,atk:5,def:1,mp:5,xp:9},
 walker:{nom:'Der Panzerläufer',acc:'den Panzerläufer',n:'Panzerläufer',hp:22,atk:7,def:3,mp:2,xp:12,robot:1},
 spitter:{nom:'Der Säurespucker',acc:'den Säurespucker',n:'Säurespucker',hp:8,atk:3,def:0,mp:3,xp:6,range:4,acid:1},
 breaker:{nom:'Der Brecher',acc:'den Brecher',n:'Brecher',hp:16,atk:5,def:2,mp:2,xp:8,smash:1},
 queen:{nom:'Die Brutmutter',acc:'die Brutmutter',n:'Brutmutter',hp:70,atk:8,def:3,mp:2,xp:60,boss:1,range:5}
};
const RTABLE={1:{larva:5,drone:4,mutant:1,spitter:1},2:{larva:2,drone:3,mutant:4,turret:2,hunter:1,spitter:2,breaker:2},3:{mutant:3,turret:2,hunter:3,walker:2,drone:1,spitter:1,breaker:2}};
const ELITE={1:'mutant',2:'hunter',3:'walker'};

const IT={
 med:{n:'Medi-Injektor',d:'heilt 12 TP'},
 cell:{n:'Energiezelle',d:'+4 Munition'},
 nade:{n:'Splittergranate',d:'Ziel wählen: 8 Schaden im 3×3-Feld'},
 stim:{n:'Kampfstimulans',d:'+3 Angriff für 3 Runden'},
 scan:{n:'Bewegungsmelder',d:'zeigt, wo alle Gegner im Raum stehen'},
 phase:{n:'Phasenkapsel',d:'teleportiert dich weg von den Gegnern'},
 mine:{n:'Annäherungsmine',d:'auf dein Feld legen: 8 Schaden für den ersten Gegner, der darauf tritt'},
 flash:{n:'Blendgranate',d:'lähmt alle Gegner in Sicht für 1 Runde',spr:'nade',map:{n:'#9aa6b2',G:'#eef3f6'}},
 barrier:{n:'Notschild',d:'eine Runde lang kein Schaden durch Gegner',spr:'cell',map:{y:'#5fd3e6',a:'#227f92'}},
 wrench:{n:'Rohrzange',slot:'wpn',v:1,spr:'blade',map:{x:'#9aa6b2',X:'#56616e'}},
 blade:{n:'Vibroklinge',slot:'wpn',v:2,spr:'blade',map:{x:'#5fd3e6',X:'#eef3f6'}},
 cutter:{n:'Plasmaschneider',slot:'wpn',v:4,spr:'blade',map:{x:'#ff8a3d',X:'#ffe066'}},
 vest:{n:'Schutzweste',slot:'arm',v:1,spr:'armor',map:{h:'#56616e',H:'#9aa6b2'}},
 suit:{n:'Kampfanzug',slot:'arm',v:2,spr:'armor',map:{h:'#227f92',H:'#5fd3e6'}},
 exo:{n:'Exo-Panzer',slot:'arm',v:3,spr:'armor',map:{h:'#9a5d06',H:'#ffb000'}}
};
const ITABLE={1:{med:4,cell:4,nade:1,wrench:2,vest:2,stim:1,mine:1,flash:1},2:{med:4,cell:3,nade:2,blade:2,suit:1,vest:1,stim:1,phase:1,scan:1,mine:2,flash:1,barrier:1},3:{med:5,cell:3,nade:2,cutter:2,exo:1,suit:1,stim:1,phase:1,mine:2,flash:1,barrier:1},4:{med:3,cell:2,nade:2,barrier:1}};
/* Raum-Ereignisse: ab Raum 2 hat ein Teil der Räume eine Besonderheit (nicht die Brutkammer) */
const EVENTS={
 dark:{n:'Stromausfall',d:'Du und die Gegner sehen nur 4 Felder weit.'},
 coolant:{n:'Kühlmittelleck',d:'Glatter Boden: Alle kommen pro Runde 1 Feld weniger weit.'},
 cache:{n:'Vorratskammer',d:'Hier liegt zusätzliche Ausrüstung.'},
 alarm:{n:'Alarm',d:'Die Gegner wissen von Anfang an, wo du bist.'}};
const EVENT_CHANCE=.4,DARK_SIGHT=4;
const SHAPES=[[[0,0]],[[0,0],[1,0]],[[0,0],[0,1]],[[0,0],[1,0],[0,1],[1,1]],[[0,0],[1,0],[2,0]],[[0,0],[0,1],[0,2]],[[0,0],[1,0],[0,1]],[[0,0],[1,0],[1,1]]];

/* ---------- Englische Fassung: gleiche Schlüssel, gleiche Reihenfolge (Raumnamen werden per Index gewählt) ---------- */
const EN={
 TIERNAME:['Cargo Deck','Living Quarters','Reactor Ring','Brood Chamber'],
 ROOMNAMES:{1:['Cargo Airlock','Container Store','Loading Bay','Maintenance Shaft','Spare Parts Store'],2:['Mess Hall','Crew Bunks','Med Bay','Hydroponics Tanks','Lab B','Recreation Module'],3:['Reactor Control','Coolant Pumps','Armory','Comms Room','Turbine Hall']},
 CLS:{
  marine:{n:'Marine',ab:'Barrage',abd:'hits all adjacent enemies with attack +3. Cooldown 3 rounds.',gear:'Start: Med Injector, 6 rounds'},
  tech:{n:'Technician',ab:'EMP Pulse',abd:'stuns all visible enemies for 2 rounds, machines take 6 damage. Cooldown 4 rounds.',gear:'Start: Med Injector, Motion Tracker, 4 rounds'},
  eng:{n:'Engineer',ab:'Sentry Gun',abd:'places a sentry gun next to you. For 4 rounds it shoots the nearest enemy in its sight every round (up to 6 tiles). Cooldown 5 rounds.',gear:'Start: Med Injector, Proximity Mine, 4 rounds'},
  scout:{n:'Scout',ab:'Cloak Field',abd:'invisible for 2 rounds, enemies lose your trail. Moves 4 tiles, dodges 15 %.',side:'Needle Pistol',gear:'Start: Med Injector, Phase Capsule, 5 rounds, Needle Pistol (needs no ammo, weak)'}},
 UNLD:{
  marine:['Starts with +5 HP','Barrage: cooldown 2','Frag Grenade (T): 8 damage in a 3×3 area, up to 5 tiles, cooldown 4'],
  tech:['Starts with an Energy Cell (+4 ammo)','EMP stuns for 3 rounds','Shield Generator (T): no damage from enemies for 2 rounds, cooldown 5'],
  scout:['Needle Pistol deals full damage','Cloak Field lasts 3 rounds','Ambush: attacks out of the cloak deal double damage'],
  eng:['Starts with a Frag Grenade','Sentry gun deals +2 damage','Sentry gun stays until the fight is over']},
 AB2:{marine:{n:'Frag Grenade'},tech:{n:'Shield Generator'}},
 MON:{
  larva:{nom:'The larva',acc:'the larva',n:'Larva'},
  drone:{nom:'The maintenance drone',acc:'the maintenance drone',n:'Maintenance Drone'},
  mutant:{nom:'The mutated technician',acc:'the mutated technician',n:'Mutated Technician'},
  turret:{nom:'The gun turret',acc:'the gun turret',n:'Gun Turret'},
  hunter:{nom:'The xeno hunter',acc:'the xeno hunter',n:'Xeno Hunter'},
  walker:{nom:'The armored walker',acc:'the armored walker',n:'Armored Walker'},
  spitter:{nom:'The acid spitter',acc:'the acid spitter',n:'Acid Spitter'},
  breaker:{nom:'The breaker',acc:'the breaker',n:'Breaker'},
  queen:{nom:'The Brood Mother',acc:'the Brood Mother',n:'Brood Mother'}},
 IT:{
  med:{n:'Med Injector',d:'heals 12 HP'},cell:{n:'Energy Cell',d:'+4 ammo'},nade:{n:'Frag Grenade',d:'pick a target: 8 damage in a 3×3 area'},
  stim:{n:'Combat Stim',d:'+3 attack for 3 rounds'},scan:{n:'Motion Tracker',d:'shows where every enemy in the room is'},phase:{n:'Phase Capsule',d:'teleports you away from the enemies'},
  mine:{n:'Proximity Mine',d:'place on your tile: 8 damage to the first enemy that steps on it'},flash:{n:'Flash Grenade',d:'stuns all enemies in sight for 1 round'},barrier:{n:'Emergency Shield',d:'no damage from enemies for one round'},
  wrench:{n:'Pipe Wrench'},blade:{n:'Vibro Blade'},cutter:{n:'Plasma Cutter'},vest:{n:'Protective Vest'},suit:{n:'Combat Suit'},exo:{n:'Exo Armor'}},
};
/* Raumnamen sprachunabhängig: Im Run steht der Name, mit dem der Raum erzeugt wurde (Deutsch oder Englisch). */
const ROOM_DE=Object.fromEntries(Object.entries(ROOMNAMES).map(([k,a])=>[k,a.slice()])),BOSS_ROOM={de:'Brutkammer',en:'Brood Chamber'};
function roomTitle(name){
  if(name===BOSS_ROOM.de||name===BOSS_ROOM.en)return L(BOSS_ROOM.de,BOSS_ROOM.en);
  for(const t in ROOM_DE){let i=ROOM_DE[t].indexOf(name);if(i<0)i=EN.ROOMNAMES[t].indexOf(name);if(i>=0)return L(ROOM_DE[t][i],EN.ROOMNAMES[t][i])}
  return name;
}
const bossRoomName=()=>L(BOSS_ROOM.de,BOSS_ROOM.en);
/* Todesursache: gespeichert als Gegner-Schlüssel bzw. 'nade'; ältere Einträge enthalten noch deutschen Text */
function causeName(c){
  if(MON[c])return MON[c].nom;
  if(c==='nade')return L('Die eigene Granate','Your own grenade');
  return c||'';
}
EN.EVENTS={dark:{n:'Power Outage',d:'You and the enemies only see 4 tiles far.'},coolant:{n:'Coolant Leak',d:'Slippery floor: everyone moves 1 tile less per round.'},cache:{n:'Supply Room',d:'Extra equipment lies here.'},alarm:{n:'Alarm',d:'The enemies know where you are from the start.'}};
localize({TIERNAME,ROOMNAMES,CLS,UNLD,AB2,MON,IT,EVENTS},EN);

export {roomTitle,bossRoomName,causeName};
export {RW,RH,T,ROOMS,INV,WALL,FLOOR,BLOCK,DOOR,EXIT,POD,D8,OPP,TIERNAME,ROOMNAMES,FLOORTINT,ALPH,tierOf,CLS,UNL,UNLD,AB2,MON,RTABLE,ELITE,IT,ITABLE,SHAPES,EVENTS,EVENT_CHANCE,DARK_SIGHT};
