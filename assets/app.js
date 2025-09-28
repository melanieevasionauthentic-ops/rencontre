// --- PATCH CARTE (ne pas supprimer) ---
document.addEventListener('DOMContentLoaded', () => {
  try {
    const el = document.getElementById('map');
    if (!el || !window.L) return;         // pas de conteneur carte = pas de carte
    const map = L.map('map').setView([48.8566, 2.3522], 13); // Paris par défaut
    L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
      maxZoom: 19, attribution: '&copy; OpenStreetMap'
    }).addTo(map);
    window.__SERENDI_MAP = map;           // utile plus tard
    // Essaie d’utiliser ta vraie géoloc si autorisée
    if (navigator.geolocation) {
      navigator.geolocation.getCurrentPosition(
        (pos) => { map.setView([pos.coords.latitude, pos.coords.longitude], 15); },
        () => {} // on laisse Paris si refus
      );
    }
  } catch(e) {
    alert('Erreur carte: ' + e.message);
  }
});
// --- FIN PATCH CARTE ---

const $ = s => document.querySelector(s);
const toast = (m)=>{const t=$("#toast"); if(!t) return; t.textContent=m; t.classList.add("show"); setTimeout(()=>t.classList.remove("show"),2200);};

const readSettings = () => { try{return JSON.parse(localStorage.getItem('settings')||'{}')}catch(e){return{}} };
const writeSettings = (s) => localStorage.setItem('settings', JSON.stringify(s));
const readProfile = () => { try{return JSON.parse(localStorage.getItem('profile')||'{}')}catch(e){return{}} };
const writeProfile = (p) => localStorage.setItem('profile', JSON.stringify(p));
const writeFlag = (k,v)=>localStorage.setItem(k, JSON.stringify(v));
const readFlag = (k)=>{ try{return JSON.parse(localStorage.getItem(k)||'null')}catch(e){return null} };

function num(sel){ const v = Number($(sel)?.value); return isFinite(v) ? v : null; }
function val(sel){ return ($(sel)?.value || "").trim(); }
function checked(sel){ return $(sel)?.checked || false; }
function multi(sel){ return Array.from($(sel)?.selectedOptions || []).map(o=>o.value); }

function saveProfile(){
  const p = {
    display_name: val('#display_name') || '',
    my_gender: val('#my_gender') || '',
    my_orientation: multi('#my_orientation'),
    age: num('#age'), height: num('#height'), hair: val('#hair'), body: val('#body'),
    religion: val('#religion'), diet: val('#diet'),
    bio: (val('#bio')||'').slice(0,2400),
    recognize: val('#recognize') || '',
    seek: { women:checked('#seek_women'), men:checked('#seek_men'), nb:checked('#seek_nb'), trans:checked('#seek_trans') },
    orientation: multi('#orientation'),
    relation_type: val('#relation_type')||'',
    want: { age:[num('#want_age_min'), num('#want_age_max')], height:[num('#want_h_min'), num('#want_h_max')] }
  };
  writeProfile(p);
  toast("Profil enregistré.");
  renderSummary();
  setTimeout(()=>{ window.location.href='/rencontre/index.html'; }, 80);
}

function renderSummary(){
  const el = $("#profile-summary"); if(!el) return;
  const p = readProfile();
  if(!p || !p.display_name){ el.innerHTML = "<small>Crée ou complète ton profil.</small>"; return; }
  const chips=[];
  if(p.display_name) chips.push(`<chip>Nom/Pseudo ${p.display_name}</chip>`);
  if(p.my_gender) chips.push(`<chip>Genre ${p.my_gender}</chip>`);
  if(p.my_orientation?.length) chips.push(`<chip>Orientation ${p.my_orientation.join(", ")}</chip>`);
  if(p.age) chips.push(`<chip>Âge ${p.age}</chip>`);
  if(p.height) chips.push(`<chip>Taille ${p.height} cm</chip>`);
  if(p.hair) chips.push(`<chip>Cheveux ${p.hair}</chip>`);
  if(p.body) chips.push(`<chip>Corps ${p.body}</chip>`);
  if(p.relation_type) chips.push(`<chip>Relation ${p.relation_type}</chip>`);
  el.innerHTML = chips.join(" ");
}

function getRadius(){ return (readSettings().radius || 1000); }
function applyRadius(){ const el=$("#radius-display"); if(el) el.textContent=String(getRadius()); }

function isAvailable(){ const until = readFlag('avail_until'); return (until && Date.now() < until); }
function setAvailable(min){ writeFlag('avail_until', Date.now()+min*60*1000); updateAvailabilityUI(); }
function clearAvailable(){ localStorage.removeItem('avail_until'); updateAvailabilityUI(); }
function updateAvailabilityUI(){
  const t=$("#avail-text"); if(!t) return;
  if(isAvailable()){
    const left = Math.max(0, Math.round((readFlag('avail_until')-Date.now())/60000));
    t.textContent = `Vous êtes visible encore ~${left} min.`;
  }else{
    t.textContent = "Vous n’êtes pas visible. Vous recevez quand même les notifications.";
  }
}

// --- Carte / géoloc ---
const GEO_OPTS = { enableHighAccuracy:true, timeout:15000, maximumAge:15000 };
function saveLastPos(lat, lon){ try{ localStorage.setItem('last_pos', JSON.stringify([lat,lon])); }catch(e){} }
function loadLastPos(){ try{ return JSON.parse(localStorage.getItem('last_pos')||'null'); }catch(e){ return null; } }

let _map, _selfMarker, _watchId=null, _mapCentered=false;
function initMap(){
  const box = document.getElementById('map'); if(!box) return;
  if(!_map){
    _map = L.map('map');
    L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png',{maxZoom:19}).addTo(_map);
  }
  const last = loadLastPos();
  const start = last || [48.8566,2.3522];
  if(!_mapCentered){ _map.setView(start, 14); _mapCentered=true; }
  if(!_selfMarker){ _selfMarker = L.circleMarker(start,{radius:8,color:'#22d3ee'}).addTo(_map); }

  navigator.geolocation.getCurrentPosition(pos=>{
    const {latitude:lat, longitude:lon} = pos.coords;
    saveLastPos(lat,lon); _selfMarker.setLatLng([lat,lon]);
    if(!_mapCentered){ _map.setView([lat,lon], 15); _mapCentered=true; }
  }, _=>{}, GEO_OPTS);

  if(_watchId!==null) { navigator.geolocation.clearWatch(_watchId); }
  _watchId = navigator.geolocation.watchPosition(pos=>{
    const {latitude:lat, longitude:lon} = pos.coords;
    saveLastPos(lat,lon); _selfMarker.setLatLng([lat,lon]);
    if(isAvailable()) upsertPresence(lat, lon);
  }, _=>{}, GEO_OPTS);
}

// --- Supabase présence / proches ---
const CID = (function(){ let id=localStorage.getItem('cid'); if(!id){ id=(crypto.randomUUID?.()||Date.now()+"-"+Math.random()); localStorage.setItem('cid',id);} return id; })();
function sbClient(){ if(!window.SERENDI_CFG) return null; return window.supabase.createClient(SERENDI_CFG.SUPABASE_URL, SERENDI_CFG.SUPABASE_ANON); }

async function upsertPresence(lat, lon){
  const sb = sbClient(); if(!sb) return;
  const now = Date.now();
  const expires = new Date(now + 60*60*1000).toISOString();
  const { error } = await sb.from('presence').upsert({
    id: CID, lat, lon, radius_m:getRadius(),
    updated_at: new Date(now).toISOString(),
    expires_at: expires
  });
  if(error) toast('Erreur présence: '+error.message);
}

function distMeters(a,b){
  const [lat1,lon1]=a,[lat2,lon2]=b, R=6371000, toRad=x=>x*Math.PI/180;
  const dLat=toRad(lat2-lat1), dLon=toRad(lon2-lon1);
  const s1=Math.sin(dLat/2), s2=Math.sin(dLon/2);
  const aa = s1*s1 + Math.cos(toRad(lat1))*Math.cos(toRad(lat2))*s2*s2;
  return 2*R*Math.atan2(Math.sqrt(aa), Math.sqrt(1-aa));
}

let _nearbyMarkers=[];
function renderNearby(list){
  const sel = $('#nearby-select');
  if(sel) sel.innerHTML = '<option value="">— choisir —</option>' + list.map(p=>`<option value="${p.id}">#${p.id.slice(0,4)} — ${(p.d|0)} m</option>`).join('');
  document.querySelector('.kpi .v')?.textContent = String(list.length);

  _nearbyMarkers.forEach(m=>_map.removeLayer(m)); _nearbyMarkers=[];
  list.forEach(p=>{ const m=L.circleMarker([p.lat,p.lon],{radius:6,color:'#a78bfa'}).addTo(_map); _nearbyMarkers.push(m); });

  const box = $('#nearby-desc');
  if(sel && box){
    sel.onchange = ()=>{
      const c = list.find(x=>x.id===sel.value);
      box.textContent = c ? `ID ${c.id.slice(0,8)} — ~${c.d|0} m` : 'En attente d’une proximité…';
    };
  }
}

async function fetchNearby(){
  const sb = sbClient(); if(!sb) return [];
  const { data, error } = await sb.from('presence').select('id,lat,lon,updated_at,radius_m').gt('expires_at', new Date().toISOString()).limit(500);
  if(error){ toast('Erreur lecture présence'); return []; }
  const me = loadLastPos(); if(!me) return [];
  const r = getRadius();
  const list = (data||[])
    .filter(p=>p.id!==CID && isFinite(p.lat) && isFinite(p.lon))
    .map(p=>({ ...p, d: distMeters(me,[p.lat,p.lon]) }))
    .filter(p=>p.d<=r)
    .sort((a,b)=>a.d-b.d);
  renderNearby(list);
  return list;
}

let _radarTimer=null;
function startRadarLoops(){ if(_radarTimer) clearInterval(_radarTimer); _radarTimer=setInterval(fetchNearby,15000); fetchNearby(); }

(function start(){
  const run = ()=>{
    $("#btn-save-profile")?.addEventListener('click',(e)=>{ e.preventDefault(); saveProfile(); });
    $("#btn-save-settings")?.addEventListener('click',(e)=>{
      e.preventDefault();
      writeSettings({ quiet:($('#quiet')?.value||''), radius:Number($('#radius')?.value)||1000 });
      applyRadius(); initMap(); toast('Réglages enregistrés.');
    });

    applyRadius(); initMap(); updateAvailabilityUI();

    $("#btn-available")?.addEventListener('click', async ()=>{
      if(isAvailable()){ clearAvailable(); toast('Vous n’êtes plus visible.'); }
      else {
        setAvailable(60);
        const last = loadLastPos(); if(last){ await upsertPresence(last[0], last[1]); }
        toast('Vous êtes visible ~60 min.');
        await fetchNearby();
      }
    });
    $("#btn-stealth")?.addEventListener('click', ()=>{ writeFlag('mute_until', Date.now()+3*60*60*1000); toast('Notifications en pause ~3h.'); });

    startRadarLoops();
    renderSummary();
  };
  if(document.readyState==='loading'){ document.addEventListener('DOMContentLoaded', run); } else { run(); }
})();
// --- PATCH ENREGISTREMENT PROFIL ---
document.addEventListener('DOMContentLoaded', () => {
  const btn = document.getElementById('btn-save-profile');
  if (!btn) return;
  btn.addEventListener('click', (e) => {
    e.preventDefault();
    const val = sel => (document.querySelector(sel)?.value || '').trim();
    const multi = sel => Array.from(document.querySelector(sel)?.selectedOptions || []).map(o=>o.value);

    const p = {
      display_name: val('#display_name'),
      my_gender: val('#my_gender'),
      my_orientation: multi('#my_orientation'),
      age: Number(val('#age')) || null,
      height: Number(val('#height')) || null,
      hair: val('#hair'),
      body: val('#body'),
      religion: val('#religion'),
      diet: val('#diet'),
      bio: (val('#bio') || '').slice(0, 2400),
      recognize: val('#recognize'),
      seek: {
        women: !!document.querySelector('#seek_women')?.checked,
        men: !!document.querySelector('#seek_men')?.checked,
        nb: !!document.querySelector('#seek_nb')?.checked,
        trans: !!document.querySelector('#seek_trans')?.checked,
      },
      orientation: multi('#orientation'),
      relation_type: val('#relation_type'),
      want: {
        age: [Number(val('#want_age_min')) || null, Number(val('#want_age_max')) || null],
        height: [Number(val('#want_h_min')) || null, Number(val('#want_h_max')) || null],
      },
    };

    try {
      localStorage.setItem('profile', JSON.stringify(p));
      // petit feedback
      const t = document.getElementById('toast'); 
      if (t) { t.textContent = 'Profil enregistré.'; t.classList.add('show'); setTimeout(()=>t.classList.remove('show'),1500); }
    } catch(e) {}

    // on revient au radar
    setTimeout(()=>{ window.location.href = 'index.html'; }, 200);
  });
});
// --- FIN PATCH ENREGISTREMENT PROFIL ---
