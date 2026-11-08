// Vollbild-Modus für die ganze Seite (Knopf „Vollbild“ oben rechts).
// Der Knopf erscheint nur, wenn der Browser Vollbild für Seiten kann (iPhone-Safari kann es nicht, iPad schon).
const $=id=>document.getElementById(id);
const root=document.documentElement;
const request=root.requestFullscreen||root.webkitRequestFullscreen;
const leave=document.exitFullscreen||document.webkitExitFullscreen;
const current=()=>document.fullscreenElement||document.webkitFullscreenElement||null;
const enabled=!!request&&!!(document.fullscreenEnabled||document.webkitFullscreenEnabled);

const btn=$('fsBtn');
function sync(){
  const on=!!current();
  btn.textContent=on?'Vollbild beenden':'Vollbild';
  btn.setAttribute('aria-pressed',on);
}
if(enabled&&btn){
  btn.hidden=false;
  btn.onclick=()=>{
    try{
      const r=current()?leave.call(document):request.call(root,{navigationUI:'hide'});
      if(r&&r.catch)r.catch(()=>{});
    }catch(e){}
    btn.blur();   // sonst löst die Leertaste (Zug beenden) den Knopf erneut aus
  };
  document.addEventListener('fullscreenchange',sync);
  document.addEventListener('webkitfullscreenchange',sync);
  sync();
}
