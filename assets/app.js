/* Serendi app.js v12 — carte + profil + disponibilité + Supabase présence + proches */
const $ = s => document.querySelector(s);
const toast = (m)=>{ const t=$("#toast"); if(!t) return; t.textContent=m; t.classList.add("show"); setTimeout(()=>t.classList.remove("show"),1800); };

/* ----------------- Carte (toujours visible) ----------------- */
document.addEventListener('DOMContentLoaded', () => {
  try{
    const mapEl = document.getElementById('map');
    if (!mapEl || !window.L) return;
    const map = L.map('map').setView([48.8566, 2.3522], 13);
    L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', { maxZoom: 19 }).addTo(map);
    window.__SERENDI_MAP = map;
    if (navigator.geolocation) {
      navigator.geolocation.getCurrentPosition(
        pos => map.setView([pos.coords.latitude, pos.coords.longitude], 15),
        () => {}
      );
    }
  }catch(e){}
});

/* ----------------- Profil (localStorage) ----------------- */
function readProfile(){ try{ return JSON.parse(localStorage.getItem('profile')||'{}'); }catch(e){ return {}; } }
function writeProfile(p){ try{ localStorage.setItem('profile', JSON.stringify(p)); }catch(e){} }
function val(sel){ return ($(sel)?.value || '').trim(); }
function multi(sel){ return Array.from($(sel)?.selectedOptions || []).map(o=>o.value); }
function num(sel){ const v = Number(val(sel)); return isFinite(v) ? v : null; }

document.addEventListener('DOMContentLoaded', () => {
  const btn = $('#btn-save-profile');
  if (btn){
    btn.addEventListener('click', (e) => {
      e.preventDefault();
      const p = {
        display_name: val('#display_name'),
        my_gender: val('#my_gender'),
        my_orientation: multi('#my_orientation'),
        age: num('#age'), height: num('#height'),
        hair: val('#hair'), body: val('#body'),
        religion: val('#religion'), diet: val('#diet'),
        bio: (val('#bio') || '').slice(0,2400),
        recognize: val('#recognize') || '',
        seek: {
          women: !!$('#seek_women')?.checked, men: !!$('#seek_men')?.checked,
          nb: !!$('#seek_nb')?.checked, trans: !!$('#seek_trans')?.checked
        },
        orientation: multi('#orientation'),
        relation_type: val('#relation_type'),
        want: { age:[num('#want_age_min'), num('#want_age_max')], height:[num('#want_h_min'), num('#want_h_max')] },
      };
      writeProfile(p);
      toast('Profil enregistré.');
      setTimeout(()=>location.href='index.html', 250);
    });
  }
});

function renderSummary(){
  const box = $('#profile-summary'); if(!box) return;
  const p = readProfile();
  if(!p.display_name){ box.innerHTML = '<small>Crée ou complète ton profil.</small>'; return; }
  box.innerHTML = `
    <div class="row">
      <chip>Nom/Pseudo: ${p.display_name}</chip>
      <chip>Genre: ${p.my_gender||'—'}</chip>
      <chip>Orientation: ${(p.my_orientation||[]).join(', ')||'—'}</chip>
      <chip>Âge: ${p.age||'—'}</chip>
      <chip>Taille: ${p.height? p.height+' cm':'—'}</chip>
      <chip>Cheveux: ${p.hair||'—'}</chip>
      <chip>Corps: ${p.body||'—'}</chip>
      <chip>Relation: ${p.relation_type||'—'}</chip>
      <chip>Reconnaître: ${p.recognize||'—'}</chip>
    </div>`;
}

/* ----------------- Réglages simples ----------------- */
function readSettings(){ try{ return JSON.parse(localStorage.getItem('settings')||'{}'); }catch(e){ return {}; } }
function writeSettings(s){ try{ localStorage.setItem('settings', JSON.stringify(s)); }catch(e){} }
function getRadius(){ const s = readSettings(); return s.radius || 1000; }
function applyRadiusDisplay(){ const el = document.getElementById('radius-display'); if(el) el.textContent = String(getRadius()); }
document.addEventListener('DOMContentLoaded', () => {
  renderSummary(); applyRadiusDisplay();
  const btnS = $('#btn-save-settings');
  if (btnS) {
    const rInput = document.getElementById('radius'); if (rInput) rInput.value = getRadius();
    btnS.addEventListener('click', ()=>{
      const r = Number(document.getElementById('radius')?.value)||1000;
      writeSettings({radius:r});
      toast('Réglages enregistrés.');
      applyRadiusDisplay();
    });
  }
});

/* ----------------- Dispo + Supabase présence ----------------- */
const CID = (function(){ let id=localStorage.getItem('cid'); if(!id){ id=(crypto.randomUUID?.()||Date.now()+"-"+Math.random()); localStorage.setItem('cid',id);} return id; })();
const hasSB = ()=> typeof supabase !== 'undefined' && typeof SERENDI_CFG !== 'undefined' && SERENDI_CFG.SUPABASE_URL && SERENDI_CFG.SUPABASE_ANON;
const sbClient = ()=> hasSB() ? supabase.createClient(SERENDI_CFG.SUPABASE_URL, SERENDI_CFG.SUPABASE_ANON) : null;

function saveLastPos(lat, lon){ try{ localStorage.setItem('last_pos', JSON.stringify([lat,lon])); }catch(e){} }
function loadLastPos(){ try{ return JSON.parse(localStorage.getItem('last_pos')||'null'); }catch(e){ return null; } }

let _watchId=null;
document.addEventListener('DOMContentLoaded', () => {
  if (navigator.geolocation){
    if (_watchId!==null) navigator.geolocation.clearWatch(_watchId);
    _watchId = navigator.geolocation.watchPosition(pos=>{
      const {latitude:lat, longitude:lon} = pos.coords;
      saveLastPos(lat,lon);
      if (isAvailable()) upsertPresence(lat,lon);
    }, ()=>{}, {enableHighAccuracy:true, timeout:15000, maximumAge:15000});
  }

  const btnAvail = $('#btn-available');
  const btnStealth = $('#btn-stealth');
  if (btnAvail){
    btnAvail.addEventListener('click', async ()=>{
      if (isAvailable()){ clearAvailable(); toast('Vous n’êtes plus visible.'); updateAvailabilityUI(); return; }
      setAvailable(60);
      updateAvailabilityUI();
      const last = loadLastPos();
      if (last && hasSB()) await upsertPresence(last[0], last[1]);
      if (!hasSB()) toast('Mode démo: configurez Supabase dans assets/config.js');
      await fetchNearby();
    });
  }
  if (btnStealth){
    btnStealth.addEventListener('click', ()=>{ writeFlag('mute_until', Date.now()+3*60*60*1000); toast('Notifications en pause ~3h.'); });
  }

  startRadarLoop();
  updateAvailabilityUI();
});

function writeFlag(k,v){ try{ localStorage.setItem(k, JSON.stringify(v)); }catch(e){} }
function readFlag(k){ try{ return JSON.parse(localStorage.getItem(k)||'null'); }catch(e){ return null; } }
function isAvailable(){ const until = readFlag('avail_until'); return (until && Date.now() < until); }
function setAvailable(min){ writeFlag('avail_until', Date.now()+min*60*1000); }
function clearAvailable(){ localStorage.removeItem('avail_until'); }
function updateAvailabilityUI(){
  const t=$("#avail-text"); if(!t) return;
  if(isAvailable()){
    const left = Math.max(0, Math.round((readFlag('avail_until')-Date.now())/60000));
    t.textContent = `Vous êtes visible encore ~${left} min.`;
  }else{
    t.textContent = "Vous n’êtes pas visible. Vous recevez quand même les notifications.";
  }
}

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

async function fetchNearby(){
  if(!hasSB()) return [];
  const sb = sbClient();
  const { data, error } = await sb
    .from('presence')
    .select('id,lat,lon,updated_at,radius_m')
    .gt('expires_at', new Date().toISOString())
    .limit(500);
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

function renderNearby(list){
  const sel = $('#nearby-select');
  if(sel) sel.innerHTML = '<option value="">— choisir —</option>' + list.map(p=>`<option value="${p.id}">#${p.id.slice(0,4)} — ${(p.d|0)} m</option>`).join('');
  document.querySelector('.kpi .v')?.textContent = String(list.length);
  const map = window.__SERENDI_MAP;
  if (map){
    if (window.__NEARBY__) { window.__NEARBY__.forEach(m=>map.removeLayer(m)); }
    window.__NEARBY__ = [];
    list.forEach(p=>{
      const m=L.circleMarker([p.lat,p.lon],{radius:6,color:'#a78bfa'}).addTo(map);
      window.__NEARBY__.push(m);
    });
  }
  const box = $('#nearby-desc');
  if(sel && box){
    sel.onchange = ()=>{
      const c = list.find(x=>x.id===sel.value);
      box.textContent = c ? `ID ${c.id.slice(0,8)} — ~${c.d|0} m` : 'En attente d’une proximité…';
    };
  }
}

let _radarTimer=null;
function startRadarLoop(){ if(_radarTimer) clearInterval(_radarTimer); _radarTimer = setInterval(fetchNearby, 15000); fetchNearby(); }
