
const $ = s => document.querySelector(s);
const toast = (m)=>{const t=$('#toast'); if(!t) return; t.textContent=m; t.classList.add('show'); setTimeout(()=>t.classList.remove('show'),2200);};

// Settings/Profile
const readSettings = () => { try{return JSON.parse(localStorage.getItem('settings')||'{}')}catch(e){return{}} };
const writeSettings = (s) => localStorage.setItem('settings', JSON.stringify(s));
const readProfile = () => { try{return JSON.parse(localStorage.getItem('profile')||'{}')}catch(e){return{}} };
const writeProfile = (p) => localStorage.setItem('profile', JSON.stringify(p));
const getRadius = ()=> (readSettings().radius || 100);
const applyRadius = ()=>{ const el = document.getElementById('radius-display'); if(el) el.textContent = String(getRadius()); };

function saveProfile(){
  const val = (sel)=>document.querySelector(sel)?.value || "";
  const num = (sel)=>{ const v = Number(document.querySelector(sel)?.value); return isFinite(v) ? v : null; };
  const checked = (sel)=>document.querySelector(sel)?.checked || false;
  const multi = (sel)=>Array.from(document.querySelector(sel)?.selectedOptions || []).map(o=>o.value);
  const data = {
    my_gender: val('#my_gender'), my_orientation: multi('#my_orientation'),
    age: num('#age'), height: num('#height'), hair: val('#hair'), body: val('#body'),
    religion: val('#religion'), diet: val('#diet'),
    bio: (val('#bio')||'').slice(0,2400),
    seek: { women:checked('#seek_women'), men:checked('#seek_men'), nb:checked('#seek_nb'), trans:checked('#seek_trans') },
    orientation: multi('#orientation'),
    want: { age:[num('#want_age_min'), num('#want_age_max')], height:[num('#want_h_min'), num('#want_h_max')] }
  };
  writeProfile(data); toast('Profil enregistré.'); renderSummary();
}
function renderSummary(){
  const el = $('#profile-summary'); if(!el) return;
  const p = readProfile(); const chips = [];
  if (p.my_gender) chips.push(`<chip>Genre ${p.my_gender}</chip>`);
  if (p.my_orientation && p.my_orientation.length) chips.push(`<chip>Orientation ${p.my_orientation.join(', ')}</chip>`);
  if (p.age) chips.push(`<chip>Âge ${p.age}</chip>`);
  if (p.height) chips.push(`<chip>${p.height} cm</chip>`);
  if (p.hair) chips.push(`<chip>Cheveux ${p.hair}</chip>`);
  if (p.body) chips.push(`<chip>Corps ${p.body}</chip>`);
  if (p.religion) chips.push(`<chip>Religion ${p.religion}</chip>`);
  if (p.diet) chips.push(`<chip>Régime ${p.diet}</chip>`);
  const lst=[]; const s=p.seek||{};
  if (s.women) lst.push('Femmes'); if (s.men) lst.push('Hommes'); if (s.nb) lst.push('Non binaires'); if (s.trans) lst.push('Trans');
  if (lst.length) chips.push(`<chip>Je recherche: ${lst.join(', ')}</chip>`);
  el.innerHTML = chips.length ? chips.join(' ') : '<small>Crée ou complète ton profil.</small>';
}

// Map
let map, meMarker, meCircle; let othersLayers = [];
function initMap(){
  const box = document.getElementById('map');
  if(!box || typeof L==='undefined') return;
  if(map) map.remove();
  map = L.map('map', { zoomControl: true }); window.map = map;
  L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', { maxZoom:19, attribution:'&copy; OpenStreetMap' }).addTo(map);
  if (navigator.geolocation) {
    navigator.geolocation.getCurrentPosition((pos)=>{
      renderPosition(pos.coords.latitude, pos.coords.longitude);
    }, ()=>{
      renderPosition(48.8566, 2.3522);
      toast("Géolocalisation refusée. Paris par défaut.");
    });
  } else { renderPosition(48.8566, 2.3522); }
}
function renderPosition(lat, lon){
  const r = getRadius();
  if(!map) return;
  map.setView([lat, lon], 15);
  if(meMarker) map.removeLayer(meMarker);
  if(meCircle) map.removeLayer(meCircle);
  meMarker = L.marker([lat, lon]).addTo(map).bindPopup("Vous êtes ici");
  meCircle = L.circle([lat, lon], { radius: r, fillOpacity: .08, color: '#e879f9' }).addTo(map);
  me.lat = lat; me.lon = lon;
}

// Safety
function panic(){
  const msg = 'Besoin d’un check-in. Je suis à un rendez-vous Serendi. Tout va bien ?';
  window.location.href = 'sms:?&body=' + encodeURIComponent(msg);
}

// Availability & notifications
const nowTs = () => Date.now();
const readFlag = (k)=>{ try{return JSON.parse(localStorage.getItem(k)||'null')}catch(e){return null} };
const writeFlag = (k,v)=>localStorage.setItem(k, JSON.stringify(v));
function isMuted(){ const m = readFlag('mute_until'); return m && nowTs() < m; }
function isQuietNow(){
  const s = (readSettings().quiet||'').replace('–','-').trim(); if(!s.includes('-')) return false;
  const [a,b] = s.split('-').map(t=>t.trim());
  const toMin = (hhmm)=>{ const [h,m]=hhmm.split(':').map(n=>parseInt(n||'0')); return h*60+(m||0); };
  const cur = new Date(); const mins = cur.getHours()*60+cur.getMinutes();
  const A = toMin(a), B = toMin(b); if (isNaN(A) || isNaN(B)) return false;
  return A <= B ? (mins>=A && mins<B) : (mins>=A || mins<B);
}
function notifyAllowed(){ return !(isMuted() || isQuietNow()); }
function setAvailable(minutes=60){ writeFlag('available_until', nowTs()+minutes*60*1000); pingPresence(); updateAvailabilityUI(); }
function clearAvailable(){ writeFlag('available_until', null); updateAvailabilityUI(); }
function isAvailable(){ const u = readFlag('available_until'); return u && nowTs()<u; }
function remainingMin(){ const u = readFlag('available_until'); if(!u) return 0; return Math.max(0, Math.ceil((u-nowTs())/60000)); }
function updateAvailabilityUI(){
  const b = document.getElementById('btn-available');
  const t = document.getElementById('avail-text');
  if(!b) return;
  if(isAvailable()){ const r = remainingMin(); b.textContent = `Visible (${r} min)`; if(t) t.textContent = `Vous êtes visible encore ${r} min`; }
  else { b.textContent = 'Disponible (60 min)'; if(t) t.textContent = 'Vous n’êtes pas visible. Vous recevez quand même les notifications.'; }
}
// Beep + Web Notification on new person
let lastCount = 0;
function beep(){
  try { const ctx = new (window.AudioContext||window.webkitAudioContext)();
    const o = ctx.createOscillator(); const g = ctx.createGain();
    o.type = 'sine'; o.frequency.setValueAtTime(880, ctx.currentTime);
    g.gain.setValueAtTime(0.001, ctx.currentTime);
    g.gain.exponentialRampToValueAtTime(0.2, ctx.currentTime+0.02);
    g.gain.exponentialRampToValueAtTime(0.0001, ctx.currentTime+0.4);
    o.connect(g); g.connect(ctx.destination); o.start(); o.stop(ctx.currentTime+0.45);
  } catch(e) {}
}
function maybeNotify(newCount){
  if (newCount > lastCount && notifyAllowed()){
    beep();
    if ('Notification' in window) {
      if (Notification.permission === 'granted'){
        new Notification('Serendi', { body: 'Nouvelle personne à proximité' });
      } else if (Notification.permission !== 'denied'){
        Notification.requestPermission(()=>{});
      }
    }
  }
  lastCount = newCount;
}

// Supabase radar
const cfg = window.SERENDI_CFG || {}; let sb = null;
if (window.supabase && cfg.SUPABASE_URL && cfg.SUPABASE_ANON){
  sb = window.supabase.createClient(cfg.SUPABASE_URL, cfg.SUPABASE_ANON);
}
function distM(lat1, lon1, lat2, lon2){
  const R=6371000, toRad=d=>d*Math.PI/180;
  const dLat=toRad(lat2-lat1), dLon=toRad(lon2-lon1);
  const a=Math.sin(dLat/2)**2 + Math.cos(toRad(lat1))*Math.cos(toRad(lat2))*Math.sin(dLon/2)**2;
  return 2*R*Math.asin(Math.sqrt(a));
}
let me = { lat:null, lon:null };

async function pingPresence(){
  if(!sb || me.lat==null) return;
  const radius = getRadius();
  const bio = (readProfile().bio || '').slice(0, 1200);
  const exp = new Date(Date.now() + 60*60*1000).toISOString(); // 60 min
  const ins = await sb.from('presence').insert({ lat: me.lat, lon: me.lon, radius_m: radius, bio_short: bio, expires_at: exp });
  if(ins.error){ console.error(ins.error); toast('Erreur envoi présence'); }
}
async function fetchNearby(){
  if(!sb || me.lat==null) return;
  const res = await sb.from('presence')
    .select('lat,lon,radius_m,bio_short,updated_at,expires_at')
    .gt('expires_at', new Date().toISOString())
    .order('updated_at', { ascending:false })
    .limit(200);
  const { data, error } = res; if(error){ console.error(error); toast('Erreur lecture présence'); return; }
  const r = getRadius();
  const inRange = (data||[]).filter(p => distM(me.lat, me.lon, p.lat, p.lon) <= Math.min(r, p.radius_m));
  const countEl = document.querySelector('.kpi .v'); if(countEl) countEl.textContent = String(inRange.length);
  try{ maybeNotify(inRange.length); }catch(e){}
  const descEl = document.getElementById('nearby-desc');
  if(descEl) descEl.innerHTML = inRange[0]?.bio_short ? inRange[0].bio_short : "<i>En attente d’une proximité…</i>";
  if(typeof L!=='undefined' && map){
    othersLayers.forEach(m => map.removeLayer(m)); othersLayers = [];
    othersLayers = (inRange||[]).map(p => L.circleMarker([p.lat, p.lon], { radius:6 }).addTo(map));
  }
}
function startRadarLoops(){
  if (navigator.geolocation) {
    navigator.geolocation.watchPosition((pos)=>{ me.lat=pos.coords.latitude; me.lon=pos.coords.longitude; }, ()=>{}, { enableHighAccuracy:true });
  }
  // écoute permanente
  setInterval(fetchNearby, 10000);
  // ping seulement si visible + MAJ UI
  setInterval(()=>{ if(isAvailable()) pingPresence(); updateAvailabilityUI(); }, 5*60*1000);
}

document.addEventListener('DOMContentLoaded', ()=>{
  $('#btn-save-profile')?.addEventListener('click', (e)=>{ e.preventDefault(); saveProfile(); });
  renderSummary();
  const s = readSettings(); if($('#quiet') && s.quiet) $('#quiet').value = s.quiet; if($('#radius') && s.radius) $('#radius').value = String(s.radius);
  $('#btn-save-settings')?.addEventListener('click', (e)=>{ e.preventDefault(); writeSettings({ quiet:($('#quiet')?.value||''), radius:Number($('#radius')?.value)||100 }); applyRadius(); initMap(); toast('Réglages enregistrés.'); });
  applyRadius(); initMap(); updateAvailabilityUI();
  $('#btn-panic')?.addEventListener('click', panic);
  document.getElementById('btn-available')?.addEventListener('click', async ()=>{ if(isAvailable()){ clearAvailable(); toast('Vous n’êtes plus visible.'); } else { setAvailable(60); toast('Vous êtes visible pendant ~60 min.'); await fetchNearby(); } });
  document.getElementById('btn-stealth')?.addEventListener('click', ()=>{ writeFlag('mute_until', Date.now() + 3*60*60*1000); toast('Notifications en pause ~3h.'); });
  startRadarLoops();
});
