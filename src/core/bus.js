// Kleiner Ereignis-Bus: Die Spiellogik meldet, was passiert ist,
// Darstellung (Phaser), Oberfläche (DOM) und Ton hören zu.
// Ereignisse: change, fx, sfx, banner, hurt, screen, reset
const handlers=new Map();
export function on(ev,fn){if(!handlers.has(ev))handlers.set(ev,new Set());handlers.get(ev).add(fn);return()=>handlers.get(ev).delete(fn)}
export function emit(ev,...args){const hs=handlers.get(ev);if(hs)for(const fn of hs)fn(...args)}
