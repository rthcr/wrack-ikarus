// Konstanten und Datentabellen von Wrack Ikarus.
// Aus der klassischen Version übernommen, Inhalt unverändert.

const RW=17,RH=13,T=8,ROOMS=9,INV=6;
const WALL=0,FLOOR=1,BLOCK=2,DOOR=3,EXIT=4,POD=5;
const D8=[[1,0],[-1,0],[0,1],[0,-1],[1,1],[1,-1],[-1,1],[-1,-1]];
const OPP={L:'R',R:'L',T:'B',B:'T'};
const TIERNAME=['Frachtdeck','Wohnbereich','Reaktorring','Brutkammer'];
const ROOMNAMES={1:['Frachtschleuse','Containerlager','Ladebucht','Wartungsschacht','Ersatzteillager'],2:['Kantine','Schlafkojen','Krankenstation','Hydrokulturbecken','Labor B','Freizeitmodul'],3:['Reaktorsteuerung','Kühlmittelpumpen','Waffenkammer','Funkraum','Turbinenhalle']};
const FLOORTINT=['#1a222c','#17231f','#271e1a','#211a28'];
const ALPH='ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
const tierOf=i=>i>=ROOMS?4:i<=3?1:i<=6?2:3;

const PAL={k:'#06080b',w:'#eef3f6',g:'#9aa6b2',d:'#56616e',D:'#2c343e',c:'#5fd3e6',C:'#227f92',a:'#ffb000',A:'#9a5d06',r:'#ff4d3d',R:'#8f1f1a',G:'#8bdc5f',n:'#3f8a2c',p:'#b779e8',P:'#5b2e86',y:'#ffe066',o:'#ff8a3d'};
const SPR={
 player:["..hhhh..",".hccccH.",".hcwccH.","..hhhh..",".dhhhhd.","d.hHHh.d","..h..h..",".DD..DD."],
 larva:["........","........","...GG...","..GnGG..",".GGGGnG.","GnGGGGG.",".G.G.G.G","........"],
 drone:["..d..d..","...dd...",".dggggd.","dgkrrkgd","dggggggd",".dggggd.","..d..d..",".d....d."],
 mutant:["..pppp..",".prpprp.",".pppppp.","..PppP..",".pPPPPp.","p.PPPP.p","..P..P..",".PP..PP."],
 turret:["...gg...","...gg...","..dggd..",".dgrrgd.",".dggggd.","..dddd..",".DddddD.","DDDDDDDD"],
 hunter:["C......C","cC.CC.Cc",".CccccC.",".CyccyC.","..CccC..",".CCccCC.","C.C..C.C","c......c"],
 walker:[".dddddd.","dggggggd","dgrggrgd","dggggggd","DddddddD","gD.DD.Dg",".g.gg.g.","dd....dd"],
 queen:["p.pPPp.p",".pppppp.","ppyppypp","pPppppPp",".pGGGGp.","pp.GG.pp","p.pppp.p","p..pp..p"],
 med:["........",".wwwwww.",".wwrrww.",".wrrrrw.",".wrrrrw.",".wwrrww.",".wwwwww.","........"],
 cell:["...dd...","..yyyy..","..yaay..","..yyyy..","..yaay..","..yyyy..","..yyyy..","........"],
 nade:["....d...","...dg...","..nnnn..",".nGnnnn.",".nnnnnn.",".nnnnnn.","..nnnn..","........"],
 stim:["......w.",".....w..","....cw..","...ccc..","..ccc...",".ccc....",".gc.....","g......."],
 scan:["........",".dddddd.",".dccccd.",".dcCccd.",".dccccd.",".dddddd.",".dgddgd.","........"],
 phase:["........","...pp...","..pwwp..",".pwccwp.",".pwccwp.","..pwwp..","...pp...","........"],
 blade:["......xX",".....xX.","....xX..","...xX...","..xX....",".dd.....","dd......","d......."],
 armor:["........",".hh..hh.",".hhhhhh.",".hhhhhh.",".hhHHhh.",".hhhhhh.","..hhhh..","........"]
};

const CLS={
 marine:{n:'Marine',hp:30,atk:4,def:1,ammo:6,mp:3,dodge:0,ab:'Sperrfeuer',abd:'trifft alle angrenzenden Gegner mit Angriff +3. Abklingzeit 3 Runden.',cd:3,inv:['med'],gear:'Start: Medi-Injektor, 6 Schuss',col:{h:'#8f9a3e',H:'#545b22'}},
 tech:{n:'Technikerin',hp:22,atk:3,def:1,ammo:4,mp:3,dodge:0,ab:'EMP-Impuls',abd:'lähmt alle sichtbaren Gegner 2 Runden, Maschinen nehmen 6 Schaden. Abklingzeit 4 Runden.',cd:4,inv:['med','scan'],gear:'Start: Medi-Injektor, Bewegungsmelder, 4 Schuss',col:{h:'#d7dde3',H:'#7f8b97'}},
 scout:{n:'Späherin',hp:20,atk:3,def:0,ammo:5,mp:4,dodge:.15,ab:'Tarnfeld',abd:'2 Runden unsichtbar, Gegner verlieren deine Spur. 4 Felder Bewegung, weicht 15 % aus.',cd:4,inv:['med','phase'],side:'Nadelpistole',gear:'Start: Medi-Injektor, Phasenkapsel, 5 Schuss, Nadelpistole (ohne Munition, schwach)',col:{h:'#d9644a',H:'#7d3020'}}
};
/* Dauerhafte Freischaltungen pro Klasse: LP sind alle EP, die je mit der Klasse gesammelt wurden. */
const UNL=[100,300,600];
const UNLD={
 marine:['Startet mit +5 TP','Sperrfeuer: Abklingzeit 2','Splittergranate (T): 8 Schaden im 3×3-Feld, bis 5 Felder, Abklingzeit 4'],
 tech:['Startet mit einer Energiezelle (+4 Munition)','EMP lähmt 3 Runden','Schildgenerator (T): 2 Runden kein Schaden durch Gegner, Abklingzeit 5'],
 scout:['Nadelpistole macht vollen Schaden','Tarnfeld hält 3 Runden','Hinterhalt: Angriff aus der Tarnung macht doppelten Schaden']};
const AB2={marine:{n:'Splittergranate',cd:4},tech:{n:'Schildgenerator',cd:5}};
/* Upgrades beim Stufenaufstieg: 3 zufällige zur Wahl, gelten bis Run-Ende. */
const MON={
 larva:{nom:'Die Larve',acc:'die Larve',n:'Larve',hp:4,atk:2,def:0,mp:3,xp:2},
 drone:{nom:'Die Wartungsdrohne',acc:'die Wartungsdrohne',n:'Wartungsdrohne',hp:7,atk:3,def:1,mp:3,xp:3,robot:1},
 mutant:{nom:'Der mutierte Techniker',acc:'den mutierten Techniker',n:'Mutierter Techniker',hp:12,atk:4,def:1,mp:2,xp:5},
 turret:{nom:'Der Geschützturm',acc:'den Geschützturm',n:'Geschützturm',hp:9,atk:3,def:2,mp:0,xp:5,robot:1,range:6,nomelee:1},
 hunter:{nom:'Der Xeno-Jäger',acc:'den Xeno-Jäger',n:'Xeno-Jäger',hp:13,atk:5,def:1,mp:5,xp:9},
 walker:{nom:'Der Panzerläufer',acc:'den Panzerläufer',n:'Panzerläufer',hp:22,atk:7,def:3,mp:2,xp:12,robot:1},
 queen:{nom:'Die Brutmutter',acc:'die Brutmutter',n:'Brutmutter',hp:70,atk:8,def:3,mp:2,xp:60,boss:1,range:5}
};
const RTABLE={1:{larva:5,drone:4,mutant:1},2:{larva:2,drone:3,mutant:4,turret:2,hunter:1},3:{mutant:3,turret:2,hunter:3,walker:2,drone:1}};
const ELITE={1:'mutant',2:'hunter',3:'walker'};

const IT={
 med:{n:'Medi-Injektor',d:'heilt 12 TP'},
 cell:{n:'Energiezelle',d:'+4 Munition'},
 nade:{n:'Splittergranate',d:'Ziel wählen: 8 Schaden im 3×3-Feld'},
 stim:{n:'Kampfstimulans',d:'+3 Angriff für 3 Runden'},
 scan:{n:'Bewegungsmelder',d:'zeigt, wo alle Gegner im Raum stehen'},
 phase:{n:'Phasenkapsel',d:'teleportiert dich weg von den Gegnern'},
 wrench:{n:'Rohrzange',slot:'wpn',v:1,spr:'blade',map:{x:'#9aa6b2',X:'#56616e'}},
 blade:{n:'Vibroklinge',slot:'wpn',v:2,spr:'blade',map:{x:'#5fd3e6',X:'#eef3f6'}},
 cutter:{n:'Plasmaschneider',slot:'wpn',v:4,spr:'blade',map:{x:'#ff8a3d',X:'#ffe066'}},
 vest:{n:'Schutzweste',slot:'arm',v:1,spr:'armor',map:{h:'#56616e',H:'#9aa6b2'}},
 suit:{n:'Kampfanzug',slot:'arm',v:2,spr:'armor',map:{h:'#227f92',H:'#5fd3e6'}},
 exo:{n:'Exo-Panzer',slot:'arm',v:3,spr:'armor',map:{h:'#9a5d06',H:'#ffb000'}}
};
const ITABLE={1:{med:4,cell:4,nade:1,wrench:2,vest:2,stim:1},2:{med:4,cell:3,nade:2,blade:2,suit:1,vest:1,stim:1,phase:1,scan:1},3:{med:5,cell:3,nade:2,cutter:2,exo:1,suit:1,stim:1,phase:1},4:{med:3,cell:2,nade:2}};
const SHAPES=[[[0,0]],[[0,0],[1,0]],[[0,0],[0,1]],[[0,0],[1,0],[0,1],[1,1]],[[0,0],[1,0],[2,0]],[[0,0],[0,1],[0,2]],[[0,0],[1,0],[0,1]],[[0,0],[1,0],[1,1]]];

export {RW,RH,T,ROOMS,INV,WALL,FLOOR,BLOCK,DOOR,EXIT,POD,D8,OPP,TIERNAME,ROOMNAMES,FLOORTINT,ALPH,tierOf,PAL,SPR,CLS,UNL,UNLD,AB2,MON,RTABLE,ELITE,IT,ITABLE,SHAPES};
