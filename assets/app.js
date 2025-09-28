// ===== Serendi v15.2 — app.js (carte OK + enregistrement + erreur lisible) =====
/* Utilitaires */
const $ = (s) => document.querySelector(s);
const toast = (m) => {
  const t = $('#toast'); if (!t) return;
  t.textContent = m; t.classList.add('show'); setTimeout(()=>t.classList.remove('show'), 2400);
};

/* Config Supabase */
let SUPA_URL='', SUPA_ANON='';
try { SUPA_URL = window.SERENDI_CFG?.SUPABASE_URL || ''; SUPA_ANON = window.SERENDI_CFG?.SUPABASE_ANON || ''; } catch(e){}
let supa = null;
try { if (SUPA_URL && SUPA_ANON && window.supabase) supa = window.supabase.createClient(SUPA_URL, SUPA_ANON); }
catch(e){ console.warn('Init Supabase échoué', e); }

// ---- Réception des demandes (Realtime) ----
let subIntents = null;
let lastBeepAt = 0;
function playBeep(){
  try{
    const ac = new (window.AudioContext||window.webkitAudioContext)();
    const o = ac.createOscillator(), g = ac.createGain();
    o.type='sine'; o.frequency.value=880;
    g.gain.value=0.001; g.gain.exponentialRampToValueAtTime(0.00001, ac.currentTime+0.18);
    o.connect(g); g.connect(ac.destination); o.start(); o.stop(ac.currentTime+0.2);
  }catch(e){}
}

function listenIntents(){
  if (!supa) return;
  const uid = localStorage.getItem('uid');
  if (!uid) return; // l’UID est créé au premier “Disponible”

  // (Re)abonnement propre
  if (subIntents){ try{ supa.removeChannel(subIntents); }catch(e){} subIntents = null; }

  subIntents = supa.channel('intents-to-me')
    .on('postgres_changes', {
      event: 'INSERT',
      schema: 'public',
      table: 'intents',
      filter: `to_id=eq.${uid}`
    }, (payload) => {
      // Bip unique (anti-spam ~8s)
      if (Date.now() - lastBeepAt > 8000) { playBeep(); lastBeepAt = Date.now(); }
      const from = payload?.new?.from_id?.slice(0,6) || 'Inconnu';
      toast(`Nouvelle demande (#${from})`);
    })
    .subscribe();
}

/* Stockage */
const readSettings=()=>{ try{ return JSON.parse(localStorage.getItem('settings')||'{}'); }catch(e){ return {}; } };
const writeSettings=(o)=>localStorage.setItem('settings', JSON.stringify(o));
const readProfile =()=>{ try{ return JSON.parse(localStorage.getItem('profile')||'{}'); }catch(e){ return {}; } };
const writeProfile=(o)=>localStorage.setItem('profile', JSON.stringify(o));
const getRadius = ()=> Number(readSettings().radius || 1000);
function writeFlag(k,v){ localStorage.setItem('flag:'+k, JSON.stringify({v,t:Date.now()})); }
function readFlag(k){ try{ return JSON.parse(localStorage.getItem('flag:'+k)||'{}').v; } catch(e){ return null; } }

/* Carte Leaflet */
let map, meMarker, markers = [];
function initMap(){
  const el = $('#map'); if (!el) return;
  try{
    map = L.map('map', { zoomControl:true, attributionControl:true });
    L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', { maxZoom: 19 }).addTo(map);
    map.setView([48.8566, 2.3522], 13);
  }catch(e){
    console.error(e); toast('Erreur carte');
  }
}

function locateMe(){
  if(!navigator.geolocation){ toast('Géolocalisation indisponible'); return; }
  navigator.geolocation.getCurrentPosition(pos=>{
    const { latitude, longitude } = pos.coords;
    if (map){
      map.setView([latitude, longitude], 15);
      if (meMarker) meMarker.remove();
      meMarker = L.marker([latitude, longitude], { title:'Moi' }).addTo(map);
    }
    if (readFlag('available')){
      upsertPresence(latitude, longitude).catch(e=>{
        console.warn('Présence KO', e);
        // on garde la carte, on informe juste
        toast('Erreur présence: '+ (e?.message || 'inconnue'));
      });
    }
  }, err => {
    console.warn('geo', err); toast('Autorise la position');
  }, { enableHighAccuracy:true, timeout:10000 });
}

/* Présence */
async function upsertPresence(lat, lon){
  if (!supa) { throw new Error('Supabase non configuré'); }
  const p = readProfile();
  const uid = localStorage.getItem('uid') || (crypto.randomUUID?.() || String(Date.now()));
  localStorage.setItem('uid', uid);
  const row = {
    id: uid,
    lat, lon,
    radius_m: getRadius(),
    bio_text: (p.bio||'').slice(0, 300),
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
    updated_at: new Date().toISOString(),
    expires_at: new Date(Date.now() + 60*60*1000).toISOString()
  };
  const { error } = await supa.from('presence').upsert(row, { onConflict: 'id' });
  if (error){
    // renvoyer une erreur lisible au caller, sans casser l'appli
    const err = new Error((error.code ? error.code+' ' : '') + (error.message || 'échec upsert'));
    err.code = error.code;
    throw err;
  }
}

/* Lecture des proches */
async function loadNearby(){
  if (!supa || !map) return;
  const { data, error } = await supa.from('presence')
    .select('id,lat,lon,profile,updated_at,expires_at')
    .gt('expires_at', new Date().toISOString())
    .limit(500);
  if (error){ console.warn('read presence', error); toast('Erreur lecture présence'); return; }

  // dédoublonner (garder la plus récente par id)
  const latest = new Map();
  for (const r of (data||[])){
    const prev = latest.get(r.id);
    if (!prev || new Date(r.updated_at) > new Date(prev.updated_at)) latest.set(r.id, r);
  }

  // clear anciens marqueurs
  markers.forEach(m => map.removeLayer(m)); markers = [];

  // rebuild select
  const sel = $('#nearby-select');
  if (sel){
    sel.innerHTML = '';
    const o0 = document.createElement('option'); o0.value=''; o0.textContent='— choisir —'; sel.appendChild(o0);
  }

  for (const r of latest.values()){
    if (!r.lat || !r.lon) continue;
    const prof = r.profile || {};
    const m = L.marker([r.lat, r.lon]).addTo(map);
    markers.push(m);
    const lines = [];
    if (prof.display_name) lines.push(`<b>${prof.display_name}</b>`);
    const micro = [
      prof.age ? `Âge ${prof.age}` : '',
      prof.height ? `${prof.height} cm` : '',
      prof.hair ? `Cheveux ${prof.hair}` : '',
      prof.body ? `Corps ${prof.body}` : ''
    ].filter(Boolean).join(' — ');
    if (micro) lines.push(micro);
    if (prof.relation_type) lines.push(`Relation: ${prof.relation_type}`);
    if (prof.recognize) lines.push(`Reconnaître: ${prof.recognize}`);
    m.bindPopup(lines.join('<br>'));

    if (sel){
      const o = document.createElement('option');
o.value = r.id;

const name = prof.display_name || ('#' + r.id.slice(0,6));
const gender = (prof.gender || '').toString().trim(); // ex. "Femme", "Homme"
const age = (prof.age && Number(prof.age) > 0) ? `${prof.age} ans` : '';

const bits = [name];
if (gender) bits.push(gender);
if (age) bits.push(age);

o.textContent = bits.join(' · ');
sel.appendChild(o);

    }
  }
}

/* Intents (proto “je veux te rencontrer”) */
async function sendIntent(to_id){
  if (!supa) { toast('Supabase non configuré'); return; }
  const from_id = localStorage.getItem('uid') || (crypto.randomUUID?.() || String(Date.now()));
  localStorage.setItem('uid', from_id);
  const payload = {
    from_id, to_id,
    message: 'On se croise ?',
    created_at: new Date().toISOString(),
    expires_at: new Date(Date.now()+30*60*1000).toISOString()
  };
  const { error } = await supa.from('intents').insert(payload);
  if (error){ console.warn('intent', error); toast('Envoi impossible'); return; }
  toast('Demande envoyée');
}

/* UI */
function wireUI(){
  const btnAvail = $('#btn-available');
  const btnStealth = $('#btn-stealth');
  const sel = $('#nearby-select');
  const btnReq = $('#btn-request');

  if (btnAvail){
    btnAvail.addEventListener('click', ()=>{
      writeFlag('available', true);
      toast('Visible (60 min)');
      locateMe(); // localise + envoie présence
    });
        // S’assurer que l’UID existe et écouter en temps réel
    if (!localStorage.getItem('uid')){
      localStorage.setItem('uid', (crypto.randomUUID?.() || String(Date.now())));
    }
    listenIntents();

  }
  if (btnStealth){
    btnStealth.addEventListener('click', ()=>{
      writeFlag('available', false);
      toast('Pause (3 h)');
    });
  }
  if (btnReq && sel){
    btnReq.addEventListener('click', ()=>{
      const to = sel.value;
      if (!to) { toast('Choisis une personne'); return; }
      sendIntent(to);
    });
  }
}

/* Onboarding / Settings */
function hookOnboarding(){
  const saveBtn = $('#btn-save-profile'); if(!saveBtn) return;
  saveBtn.addEventListener('click', ()=>{
    const val = (q)=> (document.querySelector(q)?.value || '').toString().trim();
    const multi = (q)=> Array.from(document.querySelector(q)?.selectedOptions||[]).map(o=>o.value);
    const p = {
      display_name: val('#display_name'),
      my_gender: val('#my_gender'),
      my_orientation: multi('#my_orientation'),
      age: Number(val('#age'))||null,
      height: Number(val('#height'))||null,
      hair: val('#hair'), body: val('#body'),
      relation_type: val('#relation_type'),
      recognize: val('#recognize'),
      bio: (val('#bio')||'').slice(0,2400)
    };
    writeProfile(p);
    toast('Profil enregistré.');
    setTimeout(()=>location.href='index.html', 250);
  });
}
function hookSettings(){
  const btn = $('#btn-save-settings'); if(!btn) return;
  btn.addEventListener('click', ()=>{
    const r = Number($('#radius')?.value || 1000);
    const s = readSettings(); s.radius = r; writeSettings(s);
    const rd = $('#radius-display'); if (rd) rd.textContent = String(r);
    toast('Réglages enregistrés');
  });
}

/* Démarrage */
document.addEventListener('DOMContentLoaded', ()=>{
  const isRadar = !!$('#map');
  const isOnb   = !!$('#display_name');
  const isSet   = !!$('#radius');

  if (isRadar){
    initMap(); wireUI(); locateMe();
    setInterval(loadNearby, 12000); loadNearby();
    const rd = $('#radius-display'); if (rd) rd.textContent = String(getRadius());
  }
  if (isOnb) hookOnboarding();
  if (isSet) hookSettings();
});
    // Garantir un uid local puis écouter les intents entrants
    if (!localStorage.getItem('uid')){
      localStorage.setItem('uid', (crypto.randomUUID?.() || String(Date.now())));
    }
    listenIntents();
