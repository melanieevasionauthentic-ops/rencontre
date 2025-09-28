// ===== Serendi v16.4.3 — pseudo + repère dans 'Rencontre en cours' =====
const $ = (s) => document.querySelector(s);
const toast = (m) => { const t=$('#toast'); if(!t) return; t.textContent=m; t.classList.add('show'); setTimeout(()=>t.classList.remove('show'),3000); };

/* Supabase */
let SUPA_URL='', SUPA_ANON='';
try { SUPA_URL = window.SERENDI_CFG?.SUPABASE_URL || ''; SUPA_ANON = window.SERENDI_CFG?.SUPABASE_ANON || ''; } catch(e){}
let supa = null;
try { if (SUPA_URL && SUPA_ANON && window.supabase) supa = window.supabase.createClient(SUPA_URL, SUPA_ANON); }
catch(e){ console.warn('Init Supabase échoué', e); }

/* Local */
const readSettings=()=>{ try{ return JSON.parse(localStorage.getItem('settings')||'{}'); }catch(e){ return {}; } };
const writeSettings=(o)=>localStorage.setItem('settings', JSON.stringify(o));
const readProfile =()=>{ try{ return JSON.parse(localStorage.getItem('profile')||'{}'); }catch(e){ return {}; } };
const writeProfile=(o)=>localStorage.setItem('profile', JSON.stringify(o));
const getRadius = ()=> Number(readSettings().radius || 1000);
function writeFlag(k,v){ localStorage.setItem('flag:'+k, JSON.stringify({v,t:Date.now()})); }
function readFlag(k){ try{ return JSON.parse(localStorage.getItem('flag:'+k)||'{}').v; } catch(e){ return null; } }

/* Rencontre active (persistante 1h) */
function setActiveMeet(obj){
  if (!obj){ localStorage.removeItem('active_meet'); renderActiveMeet(); return; }
  const now = Date.now();
  const rec = { ...obj, at: now, expires_at: now + 60*60*1000 };
  localStorage.setItem('active_meet', JSON.stringify(rec));
  renderActiveMeet();
}
function getActiveMeet(){
  try{
    const raw = localStorage.getItem('active_meet'); if(!raw) return null;
    const o = JSON.parse(raw);
    if (!o.expires_at || Date.now() > o.expires_at){ localStorage.removeItem('active_meet'); return null; }
    return o;
  }catch(e){ return null; }
}
function renderActiveMeet(){
  const box = $('#accepted-panel'); if(!box) return;
  const a = getActiveMeet();
  if (!a){ box.innerHTML = '<i>Aucune rencontre active.</i>'; return; }
  const when = new Date(a.at).toLocaleTimeString();
  const name = a.with_name || ('#'+(a.with_id||'????').slice(0,6));
  const place = a.place || 'Lieu non précisé';
  const recog = a.recognize ? `<br>Repère : <b>${a.recognize}</b>` : '';
  box.innerHTML = `<div class="notice"><b>${name}</b> — ${when}<br>Lieu proposé : <b>${place}</b>${recog}<br><button class="btn ghost" id="btn-clear-meet" style="margin-top:8px">Masquer</button></div>`;
  const b = $('#btn-clear-meet'); if (b) b.onclick = ()=>{ setActiveMeet(null); };
}

/* Carte */
let map, meMarker;
let markersById = new Map();
let profilesById = new Map(); // 👈 cache profils
let lastBeepAt = 0;

function initMap(){
  const el = document.querySelector('#map');
  if (!el) { toast('Pas de conteneur carte (#map)'); return; }
  if (typeof L === 'undefined'){ toast('Leaflet non chargé'); return; }
  try{
    map = L.map('map', { zoomControl:true, attributionControl:true });
    L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', { maxZoom: 19 }).addTo(map);
    map.setView([48.8566, 2.3522], 13);
  }catch(e){ console.error(e); toast('Erreur carte'); }
}

function playBeep(){
  try{
    const ac = new (window.AudioContext||window.webkitAudioContext)();
    const o = ac.createOscillator(), g = ac.createGain();
    o.type='sine'; o.frequency.value=880;
    g.gain.value=0.001; g.gain.exponentialRampToValueAtTime(0.00001, ac.currentTime+0.18);
    o.connect(g); g.connect(ac.destination); o.start(); o.stop(ac.currentTime+0.2);
  }catch(e){}
}

function locateMe(){
  if(!navigator.geolocation){ toast('Géolocalisation indisponible'); return; }
  navigator.geolocation.getCurrentPosition(pos=>{
    const { latitude, longitude } = pos.coords;
    window._lastGeo = { lat: latitude, lon: longitude };
    if (map){
      map.setView([latitude, longitude], 15);
      if (meMarker) meMarker.remove();
      meMarker = L.marker([latitude, longitude], { title:'Moi' }).addTo(map);
    }
    if (readFlag('available')){
      upsertPresence(latitude, longitude).catch(e=>{
        console.warn('Présence KO', e);
        toast('Erreur présence: '+ (e?.message || 'inconnue'));
      });
    }
  }, err => { console.warn('geo', err); toast('Autorise la position'); }, { enableHighAccuracy:true, timeout:10000 });
}

/* Présence */
async function upsertPresence(lat, lon){
  if (!supa) { throw new Error('Supabase non configuré'); }
  const p = readProfile();
  const uid = localStorage.getItem('uid') || (crypto.randomUUID?.() || String(Date.now()));
  localStorage.setItem('uid', uid);
  const row = {
    id: uid, lat, lon, radius_m: getRadius(),
    bio_text: (p.bio||'').slice(0, 300),
    profile: {
      display_name: p.display_name || '',
      age: p.age || null, height: p.height || null,
      hair: p.hair || '', body: p.body || '',
      relation_type: p.relation_type || '',
      recognize: p.recognize || '',
      gender: p.my_gender || '',
      orientations: p.my_orientation || []
    },
    updated_at: new Date().toISOString(),
    expires_at: new Date(Date.now() + 60*60*1000).toISOString()
  };
  const { error } = await supa.from('presence').upsert(row, { onConflict: 'id' });
  if (error){ const err = new Error((error.code ? error.code+' ' : '') + (error.message || 'échec upsert')); err.code = error.code; throw err; }
}

/* Nearby + compteur */
async function loadNearby(){
  try{
    if (!supa) return;
    const since = new Date(Date.now() - 60*60*1000).toISOString();
    const { data, error } = await supa
      .from('presence')
      .select('id, lat, lon, profile, updated_at')
      .gte('updated_at', since)
      .order('updated_at', { ascending:false })
      .limit(200);
    if (error){ console.warn('presence select', error); toast('Erreur lecture présence'); return; }

    const latest = new Map();
    (data||[]).forEach(r => { if (r?.id) latest.set(r.id, r); });

    for (const [id, mk] of markersById.entries()){
      if (!latest.has(id)){ try{ map.removeLayer(mk); }catch(e){} markersById.delete(id); profilesById.delete(id); }
    }

    const sel = document.querySelector('#nearby-select');
    if (sel){
      sel.innerHTML = '';
      const o0 = document.createElement('option'); o0.value=''; o0.textContent='— choisir —'; sel.appendChild(o0);
    }

    for (const r of latest.values()){
      if (!r.lat || !r.lon) continue;
      const prof = r.profile || {}; const id = r.id;
      profilesById.set(id, prof); // 👈 cache profil

      const name = prof.display_name || ('#' + id.slice(0,6));
      const gender = (prof.gender || '').toString().trim();
      const ageTxt = (prof.age && Number(prof.age)>0) ? `${prof.age} ans` : '';

      if (sel){ const o = document.createElement('option'); o.value = id; o.textContent = [name, gender, ageTxt].filter(Boolean).join(' · ') || name; sel.appendChild(o); }

      let mk = markersById.get(id);
      if (!mk){ mk = L.circleMarker([r.lat, r.lon], { radius: 8, color:'#4cc9f0', fillColor:'#4cc9f0', fillOpacity:0.9 }).addTo(map); markersById.set(id, mk); }
      else { mk.setLatLng([r.lat, r.lon]); }

      const micro = [ gender||'', prof.age?`Âge ${prof.age}`:'', prof.height?`${prof.height} cm`:'', prof.hair?`Cheveux ${prof.hair}`:'', prof.body?`Corps ${prof.body}`:'' ].filter(Boolean).join(' — ');
      const lines = []; if (name) lines.push(`<b>${name}</b>`); if (micro) lines.push(micro); if (prof.relation_type) lines.push(`Relation : ${prof.relation_type}`); if (prof.recognize) lines.push(`Reconnaître : ${prof.recognize}`);
      mk.bindPopup(lines.join('<br>'));
    }

    const c = document.querySelector('#nearby-count'); if (c) c.textContent = String(markersById.size || 0);
  }catch(e){ console.warn(e); toast('Problème chargement radar'); }
}

/* Intents */
async function sendIntent(to_id){
  if (!supa) { toast('Supabase non configuré'); return; }
  const from_id = localStorage.getItem('uid') || (crypto.randomUUID?.() || String(Date.now()));
  localStorage.setItem('uid', from_id);

  const p = readProfile();
  const fromName = (p.display_name || `#${from_id.slice(0,6)}`).toString();
  const place = ($('#meet_place')?.value || '').toString().trim();
  let text = `${fromName} souhaite te rencontrer.`;
  if (place) text += ` Lieu proposé : ${place}.`;
  const loc = window._lastGeo ? { lat: window._lastGeo.lat, lon: window._lastGeo.lon, radius: getRadius() } : null;

  const payload = { from_id, to_id, message: text, created_at: new Date().toISOString(),
                    expires_at: new Date(Date.now()+60*60*1000).toISOString(), loc, status: 'pending' };
  const { error } = await supa.from('intents').insert(payload);
  if (error){ toast('Intent: ' + (error.code?error.code+' ':'') + (error.message||'échec')); return; }
  toast('Demande envoyée');
  fetchSentIntents?.();
}

/* Panneau demandes reçues (Radar) */
function renderIntentsPanel(items){
  const box = document.querySelector('#intents-panel'); if (!box) return;
  if (!items || !items.length){ box.innerHTML = '<i>Aucune demande pour l’instant.</i>'; return; }
  box.innerHTML = '';
  items.forEach(it => {
    const fromShort = (it.from_id||'????').slice(0,6);
    const msg = (it.message||`Nouvelle demande (#${fromShort})`).toString();
    const row = document.createElement('div'); row.className = 'card'; row.style.margin = '8px 0';
    row.innerHTML = `
      <div style="margin-bottom:8px">${msg}</div>
      <input id="place-${it.id}" placeholder="Proposer un lieu (optionnel)">
      <div class="row" style="margin-top:8px">
        <button class="btn" data-accept="${it.id}">Je suis OK</button>
        <button class="btn ghost" data-decline="${it.id}">Pas dispo</button>
      </div>`;
    box.appendChild(row);
  });
  box.querySelectorAll('[data-accept]').forEach(b=> b.addEventListener('click', async (ev)=>{
    const id = ev.currentTarget.getAttribute('data-accept');
    const place = (document.querySelector('#place-'+id)?.value||'').toString().trim();
    await respondIntent(id, true, place);
  }));
  box.querySelectorAll('[data-decline]').forEach(b=> b.addEventListener('click', async (ev)=>{
    const id = ev.currentTarget.getAttribute('data-decline');
    await respondIntent(id, false, '');
  }));
}

async function respondIntent(id, accepted, place){
  if (!supa) { toast('Supabase non configuré'); return; }
  const payload = { status: accepted ? 'accepted' : 'declined', responded_at: new Date().toISOString(),
                    response_loc: place ? { text: place, lat: window._lastGeo?.lat || null, lon: window._lastGeo?.lon || null } : null };
  const { error } = await supa.from('intents').update(payload).eq('id', id);
  if (error){ toast('Réponse: ' + (error.message||'échec')); return; }
  toast(accepted ? 'Tu as accepté' : 'Tu as décliné');
  await fetchMyIntents();
}

async function fetchMyIntents(){
  if (!supa) return;
  const uid = localStorage.getItem('uid'); if(!uid) return;
  const since = new Date(Date.now() - 60*60*1000).toISOString();
  const { data, error } = await supa
    .from('intents')
    .select('id, from_id, message, created_at, status')
    .eq('to_id', uid)
    .eq('status', 'pending')
    .gte('created_at', since)
    .order('created_at', { ascending:false })
    .limit(50);
  if (error) return;
  renderIntentsPanel(data||[]);
}

/* Panneau des demandes envoyées & réponses (Profil) */
function renderSentIntentsPanel(items){
  const box = document.querySelector('#sent-panel'); if (!box) return;
  if (!items || !items.length){ box.innerHTML = '<i>Aucune demande envoyée dans l’heure.</i>'; return; }
  box.innerHTML = '';
  items.forEach(it=>{
    const when = new Date(it.created_at).toLocaleTimeString();
    const st = it.status || 'pending';
    const badge = st==='accepted' ? '<span class="badge ok">acceptée</span>' : st==='declined' ? '<span class="badge no">déclinée</span>' : '<span class="badge">en attente</span>';
    const place = it.response_loc?.text ? ` — lieu: <b>${(it.response_loc.text||'').toString()}</b>` : '';
    const row = document.createElement('div'); row.className='card'; row.style.margin='8px 0';
    row.innerHTML = `<div><b>${when}</b> ${badge}${place}</div>`;
    box.appendChild(row);
  });
}

async function fetchSentIntents(){
  if (!supa) return;
  const uid = localStorage.getItem('uid'); if(!uid) return;
  const since = new Date(Date.now() - 60*60*1000).toISOString();
  const { data, error } = await supa
    .from('intents')
    .select('id, to_id, created_at, status, response_loc')
    .eq('from_id', uid)
    .gte('created_at', since)
    .order('created_at', { ascending:false })
    .limit(50);
  if (error) return;
  renderSentIntentsPanel(data||[]);
}

/* Ménage doux */
async function cleanupExpiredIntents(){
  if (!supa) return;
  const cutoff = new Date(Date.now() - 3*60*60*1000).toISOString();
  try{ await supa.from('intents').delete().lt('created_at', cutoff); }catch(e){}
}

/* Realtime */
let subIntents = null, subIntentsUpdates = null;
function listenIntents(){
  if (!supa) return;
  const uid = localStorage.getItem('uid'); if(!uid) return;
  if (subIntents){ try{ supa.removeChannel(subIntents); }catch(e){} subIntents = null; }
  subIntents = supa.channel('intents-to-me')
    .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'intents', filter: `to_id=eq.${uid}` },
      (payload) => {
        const fromId = payload?.new?.from_id;
        const mk = fromId ? markersById.get(fromId) : null;
        if (mk){ mk.setStyle({ color:'#ffb703', fillColor:'#ffb703' }).bringToFront().openPopup(); }
        if (Date.now() - lastBeepAt > 8000) { playBeep(); lastBeepAt = Date.now(); }
        const msg = (payload?.new?.message || `Nouvelle demande (#${(fromId||'????').slice(0,6)})`).toString();
        toast(msg);
        fetchMyIntents();
      })
    .subscribe();
}
function listenIntentUpdates(){
  if (!supa) return;
  const uid = localStorage.getItem('uid'); if(!uid) return;
  if (subIntentsUpdates){ try{ supa.removeChannel(subIntentsUpdates); }catch(e){} subIntentsUpdates = null; }
  subIntentsUpdates = supa.channel('intents-from-me')
    .on('postgres_changes', { event: 'UPDATE', schema: 'public', table: 'intents', filter: `from_id=eq.${uid}` },
      (payload)=>{
        const st = payload?.new?.status;
        const place = payload?.new?.response_loc?.text;
        const withId = payload?.new?.to_id;
        if (st === 'accepted'){
          // 🔎 Récupère pseudo & repère depuis le cache presence
          const prof = profilesById.get(withId) || {};
          const nm = prof.display_name || ('#'+(withId||'????').slice(0,6));
          const recog = prof.recognize || '';
          const msg = place ? `Acceptée 🎉 — lieu proposé : ${place}` : 'Ta demande a été acceptée 🎉';
          toast(msg);
          setActiveMeet({ with_id: withId, with_name: nm, place: place||'Lieu non précisé', recognize: recog });
        } else if (st === 'declined'){
          toast('Ta demande a été déclinée');
        }
        fetchSentIntents();
      })
    .subscribe();
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
      if (!localStorage.getItem('uid')){ localStorage.setItem('uid', (crypto.randomUUID?.() || String(Date.now()))); }
      locateMe();
      listenIntents(); listenIntentUpdates();
    });
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
  const saveBtn = document.querySelector('#btn-save-profile'); 
  if(!saveBtn) return;

  saveBtn.addEventListener('click', ()=>{
    const val = (q)=> (document.querySelector(q)?.value || '').toString().trim();
    const multi = (q)=> Array.from(document.querySelector(q)?.selectedOptions||[]).map(o=>o.value);

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
      bio: (val('#bio')||'').slice(0,2400)
    };

    if (!p.display_name){ toast('Mets un pseudo'); return; }
    if (p.age && (p.age < 18 || p.age > 99)){ toast('Âge invalide'); return; }

    try{
      localStorage.setItem('profile', JSON.stringify(p));
      toast('Profil enregistré.');
      setTimeout(()=> location.href='index.html', 300);
    }catch(e){
      console.warn(e); toast('Enregistrement local impossible');
    }
  });

  fetchSentIntents();
  setInterval(fetchSentIntents, 20000);
  renderActiveMeet();
  setInterval(renderActiveMeet, 15000);
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

/* Start */
document.addEventListener('DOMContentLoaded', ()=>{
  const isRadar = !!document.querySelector('#map');
  const isOnb   = !!document.querySelector('#display_name');
  const isSet   = !!document.querySelector('#radius');

  if (isRadar){
    initMap(); wireUI(); locateMe();
    setInterval(loadNearby, 12000); loadNearby();
    if (!localStorage.getItem('uid')){ localStorage.setItem('uid', (crypto.randomUUID?.() || String(Date.now()))); }
    listenIntents(); listenIntentUpdates(); fetchMyIntents();
    const rd = document.querySelector('#radius-display'); if (rd) rd.textContent = String(getRadius());
    cleanupExpiredIntents();
    renderActiveMeet();
    setInterval(renderActiveMeet, 15000);
  }
  if (isOnb){ hookOnboarding(); }
  if (isSet){ hookSettings(); }
});
