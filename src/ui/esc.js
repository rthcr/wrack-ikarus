// Text sicher in HTML einsetzen: alles, was aus dem Browserspeicher oder vom Server kommt, läuft hier durch.
export const esc=t=>String(t??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
