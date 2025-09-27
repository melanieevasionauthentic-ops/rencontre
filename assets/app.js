
const $ = s => document.querySelector(s);
const toast = (m)=>{const t=$('#toast'); if(!t) return; t.textContent=m; t.classList.add('show'); setTimeout(()=>t.classList.remove('show'),2200);};

// Settings/Profile
const readSettings = () => { try{return JSON.parse(localStorage.getItem('settings')||'{}')}catch(e){return{}} };
const writeSettings = (s) => localStorage.setItem('settings', JSON.stringify(s));
const readProfile = () => { try{return JSON.parse(localStorage.getItem('profile')||'{}')}catch(e){return{}} };
const writeProfile = (p) => localStorage.setItem('profile', JSON.stringify(p));
const getRadius = ()=> (readSettings().radius || 1000);
const applyRadius = ()=>{ const el = document.getElementById('radius-display'); if(el) el.textContent = String(getRadius()); };

function saveProfile(){
  const val = (sel)=>document.querySelector(sel)?.value || "";
  const num = (sel)=>{ const v = Number(document.querySelector(sel)?.value); return isFinite(v) ? v : null; };
  const checked = (sel)=>document.querySelector(sel)?.checked || false;
  const multi = (sel)=>Array.from(document.querySelector(sel)?.selectedOptions || []).map(o=>o.value);
  const data = {
    display_name: val('#display_name') || '',
    my_gender: val('#my_gender'), my_orientation: multi('#my_orientation'),
    age: num('#age'), height: num('#height'), hair: val('#hair'), body: val('#body'),
    religion: val('#religion'), diet: val('#diet'),
    bio: (val('#bio')||'').slice(0,2400),
    recognize: val('#recognize') || '',
    seek: { women:checked('#seek_women'), men:checked('#seek_men'), nb:checked('#seek_nb'), trans:checked('#seek_trans') },
    orientation: multi('#orientation'),
    want: { age:[num('#want_age_min'), num('#want_age_max')], height:[num('#want_h_min'), num('#want_h_max')] }
  };
  writeProfile(data); toast('Profil enregistré.'); renderSummary();
  setTimeout(()=>{ window.location.href = './index.html'; }, 400);
}
function renderSummary(){
  const el = $('#profile-summary'); if(!el) return;
  const p = readProfile(); const chips = []; if (p.display_name) chips.push(`<chip>${p.display_name}</chip>`);
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
  if (p.recognize) chips.push(`<chip>Reconnaître: ${p.recognize}</chip>`);
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
// Beep joyful once per new id
let seenInRange = new Set(JSON.parse(localStorage.getItem('seen_inrange') || '[]'));
function rememberSeen(ids) { ids.forEach(id => seenInRange.add(id)); localStorage.setItem('seen_inrange', JSON.stringify(Array.from(seenInRange))); }
function beepJoy(){
  try {
    const ctx = new (window.AudioContext||window.webkitAudioContext)();
    const master = ctx.createGain(); master.gain.value = 0.08; master.connect(ctx.destination);
    [440, 554.37, 659.25].forEach((f, i)=>{
      const o = ctx.createOscillator(); const g = ctx.createGain();
      o.type = 'sine'; o.frequency.setValueAtTime(f, ctx.currentTime + i*0.01);
      g.gain.setValueAtTime(0.0001, ctx.currentTime);
      g.gain.exponentialRampToValueAtTime(0.18, ctx.currentTime + 0.06);
      g.gain.exponentialRampToValueAtTime(0.0001, ctx.currentTime + 0.45);
      o.connect(g); g.connect(master); o.start(); o.stop(ctx.currentTime + 0.5);
    });
  } catch(e) {}
}

// Supabase radar
const cfg = window.SERENDI_CFG || {}; let sb = null;
if (window.supabase && cfg.SUPABASE_URL && cfg.SUPABASE_ANON){ sb = window.supabase.createClient(cfg.SUPABASE_URL, cfg.SUPABASE_ANON); }
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
  const p = readProfile();
  const bio = (p.bio || '').slice(0, 1200);
  const rec = (p.recognize || '').slice(0, 200);
  const nameLine = (p.display_name||'').trim();
  const wantsList = []; const s = p.seek||{}; if (s.women) wantsList.push('Femmes'); if (s.men) wantsList.push('Hommes'); if (s.nb) wantsList.push('Non binaires'); if (s.trans) wantsList.push('Trans');
  const lines = [];
  if (nameLine) lines.push(`Nom/Pseudo: ${nameLine}`);
  if (p.age) lines.push(`Âge: ${p.age}`);
  if (p.height) lines.push(`Taille: ${p.height} cm`);
  if (p.hair) lines.push(`Cheveux: ${p.hair}`);
  if (p.body) lines.push(`Corps: ${p.body}`);
  if (p.religion) lines.push(`Religion: ${p.religion}`);
  if (p.diet) lines.push(`Régime: ${p.diet}`);
  if (p.my_orientation && p.my_orientation.length) lines.push(`Orientation: ${p.my_orientation.join(', ')}`);
  if (wantsList.length) lines.push(`Je recherche: ${wantsList.join(', ')}`);
  if (p.relation_type) lines.push(`Type de relation: ${p.relation_type}`);
  if (bio) lines.push(`À propos: ${bio}`);
  if (rec) lines.push(`Reconnaître: ${rec}`);
  const bioShort = lines.join('\n');  
  const exp = new Date(Date.now() + 60*60*1000).toISOString(); // 60 min
  const ins = await sb.from('presence').insert({ lat: me.lat, lon: me.lon, radius_m: radius, bio_short: bioShort, expires_at: exp });
  if(ins.error){ console.error(ins.error); toast('Erreur envoi présence'); }
}
function formatDesc(p){ return (p.bio_short||'—').replace(/\n/g,'<br>'); }
async function fetchNearby(){
  if(!sb || me.lat==null) return;
  const res = await sb.from('presence').select('id,lat,lon,radius_m,bio_short,updated_at,expires_at').gt('expires_at', new Date().toISOString()).order('updated_at', { ascending:false }).limit(300);
  const { deduped, error } = res // --- Déduplication légère par nom + proximité (~30 m)
function bucket(v){ return Math.round(v * 4000) / 4000; } // ~27 m
const byKey = new Map();

(deduped || []).forEach(p => {
  // Nom/Pseudo depuis la 1re ligne du bio_short
  const m = (p.bio_short || '').match(/Nom\/Pseudo:\s*(.*)/);
  const name = m ? m[1].split('\n')[0].trim() : '';
  const k = `${name}|${bucket(p.lat)}|${bucket(p.lon)}`;

  const prev = byKey.get(k);
  const prevTs = prev ? new Date(prev.updated_at || prev.expires_at || 0).getTime() : -1;
  const curTs  = new Date(p.updated_at || p.expires_at || 0).getTime();

  if (!prev || curTs > prevTs) byKey.set(k, p);
});

// Remplace la liste brute par la liste dédupliquée
const deduped = Array.from(byKey.values());
; if(error){ console.error(error); toast('Erreur lecture présence'); return; }
  const r = getRadius();
  const inRange = const inRange = (deduped||[]).filter(p => distM(me.lat, me.lon, p.lat, p.lon) <= Math.min(r, p.radius_m));
  const newIds = (inRange || []).map(p=>p.id).filter(id => !seenInRange.has(id));
  if (newIds.length && notifyAllowed()) { beepJoy(); if ('Notification' in window) { if (Notification.permission === 'granted'){ new Notification('Serendi', { body: 'Nouvelle personne à proximité' }); } else if (Notification.permission !== 'denied'){ Notification.requestPermission(()=>{}); } } rememberSeen(newIds); }
  const countEl = document.querySelector('.kpi .v'); if(countEl) countEl.textContent = String(inRange.length);
  const descEl = document.getElementById('nearby-desc'); if(descEl) descEl.innerHTML = (inRange[0]?.bio_short? formatDesc(inRange[0]) : "<i>En attente d’une proximité…</i>");
  if(typeof L!=='undefined' && map){
    othersLayers.forEach(m => map.removeLayer(m)); othersLayers = [];
    (deduped||[]).forEach(p => { const m = L.circleMarker([p.lat, p.lon], { radius:5, opacity:0.6, fillOpacity:0.3 }); m.addTo(map).bindPopup(formatDesc(p)); othersLayers.push(m); });
    (inRange||[]).forEach(p => { const m = L.circleMarker([p.lat, p.lon], { radius:7, opacity:1, fillOpacity:0.6 }); m.addTo(map).bindPopup(formatDesc(p)); othersLayers.push(m); });
  }
  // Dropdown of nearby
  const sel = document.getElementById('nearby-select');
  if (sel){
    const options = (inRange||[]).map((p,i)=>{
      const nameMatch = (p.bio_short||'').match(/Nom\/Pseudo:\s*(.*)/);
      const name = nameMatch ? nameMatch[1].split('\\n')[0].trim() : `#${i+1}`;
      return `<option value="${i}">${name}</option>`;
    });
    sel.innerHTML = options.length ? `<option value="" disabled selected>— choisir —</option>` + options.join('') : `<option value="" disabled>Aucun proche</option>`;
    sel.onchange = ()=>{
      const i = Number(sel.value);
      const p = (inRange||[])[i];
      if (p){
        if (map) L.popup().setLatLng([p.lat,p.lon]).setContent(formatDesc(p)).openOn(map);
        if (descEl) descEl.innerHTML = formatDesc(p);
        window._lastSelectedPresence = p;
      }
    };
  }
}
function startRadarLoops(){
  if (navigator.geolocation) {
    navigator.geolocation.watchPosition((pos)=>{ me.lat=pos.coords.latitude; me.lon=pos.coords.longitude; }, ()=>{}, { enableHighAccuracy:true });
  }
  setInterval(fetchNearby, 10000);
  setInterval(()=>{ if(isAvailable()) pingPresence(); updateAvailabilityUI(); }, 5*60*1000);
}

document.addEventListener('DOMContentLoaded', ()=>{
  $('#btn-save-profile')?.addEventListener('click', (e)=>{ e.preventDefault(); saveProfile(); });
  renderSummary();
  const s = readSettings(); if($('#quiet') && s.quiet) $('#quiet').value = s.quiet; if($('#radius') && s.radius) $('#radius').value = String(s.radius);
  $('#btn-save-settings')?.addEventListener('click', (e)=>{ e.preventDefault(); writeSettings({ quiet:($('#quiet')?.value||''), radius:Number($('#radius')?.value)||1000 }); applyRadius(); initMap(); toast('Réglages enregistrés.'); });
  applyRadius(); initMap(); updateAvailabilityUI();
  document.getElementById('btn-available')?.addEventListener('click', async ()=>{ if(isAvailable()){ clearAvailable(); toast('Vous n’êtes plus visible.'); } else { setAvailable(60); toast('Vous êtes visible pendant ~60 min.'); await fetchNearby(); } });
  document.getElementById('btn-stealth')?.addEventListener('click', ()=>{ writeFlag('mute_until', Date.now() + 3*60*60*1000); toast('Notifications en pause ~3h.'); });
  // request button
  const btnReq = document.getElementById('btn-request');
  if(btnReq){
    btnReq.onclick = async ()=>{
      const meName = (readProfile().display_name||'').trim() || 'Anonyme';
      const p = window._lastSelectedPresence;
      if(!p){ toast('Choisis d’abord une personne.'); return; }
      if(!sb){ toast('Connexion absente.'); return; }
      try{
        const r = await sb.from('intents').insert({ target_presence_id: p.id, from_name: meName, created_at: new Date().toISOString() });
        if(r.error){
          console.warn('intents insert error:', r.error);
          toast('Demande envoyée localement. (Active “intents.sql” dans Supabase pour la synchro.)');
          const loc = JSON.parse(localStorage.getItem('intents')||'[]'); loc.push({ target_presence_id: p.id, from_name: meName, at: Date.now() });
          localStorage.setItem('intents', JSON.stringify(loc));
        } else {
          toast('Demande envoyée ✔');
        }
      }catch(e){ console.error(e); toast('Demande enregistrée localement. (Voir intents.sql)'); }
    };
  }
  startRadarLoops();
});
