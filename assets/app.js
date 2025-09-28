<!-- rien à mettre ici, c'est du JS ci-dessous -->
// ===== Serendi v14 — app.js (fix) =====

// Mini utilitaires
const $ = s => document.querySelector(s);
const toast = (m) => {
  const t = $('#toast'); if(!t) return;
  t.textContent = m; t.classList.add('show'); setTimeout(()=>t.classList.remove('show'), 2500);
};

// Lire la config Supabase
let SUPA_URL = '', SUPA_ANON = '';
try {
  SUPA_URL  = window.SERENDI_CFG?.SUPABASE_URL || '';
  SUPA_ANON = window.SERENDI_CFG?.SUPABASE_ANON || '';
} catch(e){}

// Sécurité: si la config manque, on log et on ne crashe pas
if(!SUPA_URL || !SUPA_ANON){
  console.warn('Config Supabase manquante. Ouvre /assets/config.js et complète SUPABASE_URL + SUPABASE_ANON.');
}

// Supabase client
let supa = null;
try {
  supa = (SUPA_URL && SUPA_ANON) ? window.supabase.createClient(SUPA_URL, SUPA_ANON) : null;
} catch(e){ console.warn('Supabase non disponible', e); }

// Stockage local
const readSettings = () => { try { return JSON.parse(localStorage.getItem('settings')||'{}'); } catch(e){ return {}; } }
const writeSettings = (o) => localStorage.setItem('settings', JSON.stringify(o));
const readProfile  = () => { try { return JSON.parse(localStorage.getItem('profile')||'{}'); } catch(e){ return {}; } }
const writeProfile = (o) => localStorage.setItem('profile', JSON.stringify(o));

// Rayon (m)
const getRadius = () => Number(readSettings().radius || 1000);

// Carte Leaflet
let map, meMarker, layer;
function initMap(){
  const div = $('#map');
  if(!div){ return; }
  try{
    map = L.map('map', { zoomControl:true, attributionControl:true });
    layer = L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
      maxZoom: 19
    }).addTo(map);
    map.setView([48.8566,2.3522], 13); // centre provisoire
    console.log('Leaflet: OK');
  }catch(e){
    console.error('Leaflet error', e);
    toast('Erreur Leaflet');
  }
}

// Géolocalisation
function locateMe(){
  if(!navigator.geolocation){
    toast('Géolocalisation indisponible');
    return;
  }
  navigator.geolocation.getCurrentPosition(pos=>{
    const {latitude, longitude} = pos.coords;
    if(map){
      map.setView([latitude, longitude], 15);
      if(meMarker){ meMarker.remove(); }
      meMarker = L.marker([latitude, longitude], {title:'Moi'}).addTo(map);
    }
    // Publier présence si “Disponible”
    const flag = readFlag('available');
    if(flag && supa){
      upsertPresence(latitude, longitude).catch(()=>toast('Erreur envoi présence'));
    }
  }, err=>{
    console.warn('geo error', err);
    toast('Autorise la géolocalisation');
  }, {enableHighAccuracy:true, timeout:10000});
}

// Flag dispo/pause
function writeFlag(k,v){ localStorage.setItem('flag:'+k, JSON.stringify({v, t:Date.now()})); }
function readFlag(k){ try { return JSON.parse(localStorage.getItem('flag:'+k)||'{}').v; } catch(e){ return null; } }

// Présence — envoi vers Supabase
async function upsertPresence(lat, lon){
  if(!supa) return;
  const p = readProfile();
  const uid = localStorage.getItem('uid') || (crypto.randomUUID());
  localStorage.setItem('uid', uid);

  const row = {
    id: uid,
    lat, lon,
    radius_m: getRadius(),
    bio_text: (p.bio||'').slice(0,300),
    profile: {
      display_name: p.display_name || '',
      age: p.age || null,
      height: p.height || null,
      hair: p.hair || '',
      body: p.body || '',
      relation_type: p.relation_type || '',
      recognize: p.recognize || '',
      gender: p.my_gender || '',
      orientations: p.my_orientation || []
    },
    updated_at: new Date().toISOString()
  };

  const { error } = await supa.from('presence').upsert(row, { onConflict:'id' });
  if(error) { console.warn('presence upsert error', error); throw error; }
}

// Lecture des autres
async function loadNearby(){
  if(!supa || !map) return;
  // On prend un rayon “large” côté client, laisser le SQL pour plus tard si besoin
  const { data, error } = await supa.from('presence')
    .select('id,lat,lon,profile,updated_at')
    .gte('updated_at', new Date(Date.now()-60*60*1000).toISOString()); // 1h

  if(error){ console.warn('read presence error', error); toast('Erreur lecture présence'); return; }

  // Dédoublonnage par id (gardons le + récent)
  const latest = new Map();
  for(const r of data){
    const prev = latest.get(r.id);
    if(!prev || new Date(r.updated_at) > new Date(prev.updated_at)){
      latest.set(r.id, r);
    }
  }

  // Nettoyer anciens marqueurs (on garde le mien si présent)
  markers.forEach(m => map.removeLayer(m));
  markers = [];

  // Placer
  const all = [...latest.values()];
  const sel = $('#nearby-select');
  if(sel){ sel.innerHTML = ''; const opt0 = document.createElement('option'); opt0.textContent='— choisir —'; opt0.value=''; sel.appendChild(opt0); }

  for(const r of all){
    if(!r.lat || !r.lon) continue;
    const m = L.marker([r.lat, r.lon]).addTo(map);
    markers.push(m);

    // Popup — profil lisible
    const prof = r.profile || {};
    const lines = [];
    if(prof.display_name) lines.push(`<b>${prof.display_name}</b>`);
    if(prof.relation_type) lines.push(`Relation: ${prof.relation_type}`);
    const desc = [
      prof.age ? `Âge ${prof.age}` : '',
      prof.height ? `${prof.height} cm` : '',
      prof.hair ? `Cheveux ${prof.hair}` : '',
      prof.body ? `Corps ${prof.body}` : ''
    ].filter(Boolean).join(' — ');
    if(desc) lines.push(desc);
    if(prof.recognize) lines.push(`Reconnaître: ${prof.recognize}`);
    m.bindPopup(lines.join('<br>'));

    // Liste à droite
    if(sel){
      const o = document.createElement('option');
      const label = prof.display_name || `#${r.id.slice(0,6)}`;
      o.value = r.id; o.textContent = label;
      sel.appendChild(o);
    }
  }
}

let markers = [];

// Boutons
function wireUI(){
  const btnAvail = $('#btn-available');
  const btnStealth = $('#btn-stealth');
  const sel = $('#nearby-select');
  const btnReq = $('#btn-request');

  if(btnAvail){
    btnAvail.addEventListener('click', async ()=>{
      writeFlag('available', true);
      toast('Visible (60 min)');
      locateMe(); // localise et publie
    });
  }
  if(btnStealth){
    btnStealth.addEventListener('click', ()=>{
      writeFlag('available', false);
      toast('Pause (3 h)');
    });
  }
  if(sel && btnReq && supa){
    btnReq.addEventListener('click', async ()=>{
      const to_id = sel.value;
      if(!to_id){ toast('Choisis une personne'); return; }
      const from_id = localStorage.getItem('uid') || crypto.randomUUID();
      localStorage.setItem('uid', from_id);
      const payload = {
        from_id, to_id,
        message: 'On se croise ?',
        created_at: new Date().toISOString(),
        expires_at: new Date(Date.now()+30*60*1000).toISOString()
      };
      const { error } = await supa.from('intents').insert(payload);
      if(error){ toast('Envoi impossible'); console.warn(error); }
      else { toast('Demande envoyée'); }
    });
  }
}

// Onboarding (sauvegarde profil local)
function hookOnboarding(){
  const saveBtn = document.querySelector('a.btn[href="index.html"]');
  if(!saveBtn) return;
  saveBtn.addEventListener('click', ()=>{
    const val = (sel)=> (document.querySelector(sel)?.value || '').toString().trim();
    const multi = (sel)=> Array.from(document.querySelector(sel)?.selectedOptions||[]).map(o=>o.value);
    const p = {
      display_name: val('#display_name'),
      my_gender: val('#my_gender'),
      my_orientation: multi('#my_orientation'),
      age: Number(val('#age'))||null,
      height: Number(val('#height'))||null,
      hair: val('#hair'),
      body: val('#body'),
      relation_type: val('#relation_type'),
      recognize: val('#recognize'),
      bio: ''
    };
    writeProfile(p);
    toast('Profil enregistré.');
  });
}

// Réglages (rayon)
function hookSettings(){
  const btn = $('#btn-save-settings');
  if(!btn) return;
  btn.addEventListener('click', ()=>{
    const r = Number($('#radius')?.value || 1000);
    const s = readSettings(); s.radius = r; writeSettings(s);
    $('#radius-display') && ($('#radius-display').textContent = String(r));
    toast('Réglages enregistrés');
  });
}

// Démarrage
document.addEventListener('DOMContentLoaded', async ()=>{
  // Quel écran ?
  const isRadar = !!$('#map');
  const isOnb   = !!$('#display_name');
  const isSet   = !!$('#radius');

  if(isRadar){
    initMap();
    wireUI();
    locateMe();
    // rafraîchir la liste toutes les 12s
    setInterval(loadNearby, 12000);
    loadNearby();
    // affichage rayon
    $('#radius-display') && ($('#radius-display').textContent = String(getRadius()));
  }
  if(isOnb){ hookOnboarding(); }
  if(isSet){ hookSettings(); }
});

