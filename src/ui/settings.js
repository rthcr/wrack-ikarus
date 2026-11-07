// Einstellungen: Lautstärke und Stumm für Musik und Effekte getrennt, Bildfilter.
// Außerdem der Knopf "Ton einschalten", solange der Browser Ton noch blockiert.
import {on} from '../core/bus.js';
import {unlock,play,setSound,isSoundOn,setMusic,isMusicOn,setVolume,getVolume,audioState} from '../audio/sfx.js';

const $=id=>document.getElementById(id);
const dlg=$('settings');

function render(){
  for(const [kind,muted,label] of [['music',!isMusicOn(),'mus'],['sfx',!isSoundOn(),'sfx']]){
    const v=getVolume(kind);
    $(label+'Vol').value=v;$(label+'Out').textContent=v+' %';
    const b=$(label+'Mute');b.setAttribute('aria-pressed',muted);b.classList.toggle('muted',muted);b.textContent='Stumm';
    b.setAttribute('aria-label',(label==='mus'?'Musik':'Effekte')+(muted?' wieder einschalten':' stumm schalten'));
    $(label+'Vol').closest('.setrow').classList.toggle('is-muted',muted);
  }
  const st=audioState();
  $('audioHint').textContent=st==='running'?'':'Dein Browser spielt Ton erst nach einem Klick ab. Klick irgendwo auf die Seite.';
}
function chip(){
  const blocked=audioState()!=='running'&&(isMusicOn()||isSoundOn());
  $('audioUnlock').hidden=!blocked;
  if(dlg.open)render();
}

$('setBtn').onclick=()=>{unlock();render();if(typeof dlg.showModal==='function')dlg.showModal();else dlg.setAttribute('open','')};
$('setClose').onclick=e=>{e.preventDefault();dlg.close?dlg.close():dlg.removeAttribute('open')};
dlg.addEventListener('click',e=>{if(e.target===dlg)dlg.close()});   // Klick neben das Menü schließt es

$('musVol').addEventListener('input',e=>{setVolume('music',+e.target.value);if(!isMusicOn())setMusic(true);render()});
$('sfxVol').addEventListener('input',e=>{setVolume('sfx',+e.target.value);if(!isSoundOn())setSound(true);render()});
$('sfxVol').addEventListener('change',()=>play('pick'));   // Probeton beim Loslassen
$('musMute').onclick=()=>{setMusic(!isMusicOn());render();chip()};
$('sfxMute').onclick=()=>{setSound(!isSoundOn());render();chip();if(isSoundOn())play('pick')};

$('audioUnlock').onclick=()=>{unlock();setTimeout(chip,150)};
on('audiostate',chip);
chip();
