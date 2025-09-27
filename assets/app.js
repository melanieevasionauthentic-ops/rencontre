
const $ = s => document.querySelector(s);
const toast = (m)=>{const t=$('#toast'); if(!t) return; t.textContent=m; t.classList.add('show'); setTimeout(()=>t.classList.remove('show'),2000);};

// Settings
const readSettings = () => { try{return JSON.parse(localStorage.getItem('settings')||'{}')}catch(e){return{}} };
const writeSettings = (s) => localStorage.setItem('settings', JSON.stringify(s));
const getRadius = ()=> (readSettings().radius || 100);
const applyRadius = ()=>{ const el = document.getElementById('radius-display'); if(el) el.textContent = String(getRadius()); };

// Profile
const readProfile = () => { try{return JSON.parse(localStorage.getItem('profile')||'{}')}catch(e){return{}} };
const writeProfile = (p) => localStorage.setItem('profile', JSON.stringify(p));

function saveProfile(){
  const val = (sel)=>document.querySelector(sel)?.value || "";
  const num = (sel)=>{ const v = Number(document.querySelector(sel)?.value); return isFinite(v) ? v : null; };
  const checked = (sel)=>document.querySelector(sel)?.checked || false;
  const multi = (sel)=>Array.from(document.querySelector(sel)?.selectedOptions || []).map(o=>o.value);

  const data = {
    age: num('#age'),
    height: num('#height'),
    hair: val('#hair'),
    body: val('#body'),
    religion: val('#religion'),
    diet: val('#diet'),
    bio: (val('#bio')||'').slice(0,2400),
    seek: { women:checked('#seek_women'), men:checked('#seek_men'), nb:checked('#seek_nb'), trans:checked('#seek_trans') },
    orientation: multi('#orientation'),
    want: { age:[num('#want_age_min'), num('#want_age_max')], height:[num('#want_h_min'), num('#want_h_max')] }
  };
  writeProfile(data);
  toast('Profil enregistré.');
  renderSummary();
}

function renderSummary(){
  const el = $('#profile-summary'); if(!el) return;
  const p = readProfile();
  const chips = [];
  if (p.age) chips.push(`<chip>Âge ${p.age}</chip>`);
  if (p.height) chips.push(`<chip>${p.height} cm</chip>`);
  if (p.hair) chips.push(`<chip>Cheveux ${p.hair}</chip>`);
  if (p.body) chips.push(`<chip>Corps ${p.body}</chip>`);
  if (p.religion) chips.push(`<chip>Religion ${p.religion}</chip>`);
  if (p.diet) chips.push(`<chip>Régime ${p.diet}</chip>`);
  const seeks = p.seek||{}; const lst=[];
  if (seeks.women) lst.push('Femmes'); if (seeks.men) lst.push('Hommes'); if (seeks.nb) lst.push('Non binaires'); if (seeks.trans) lst.push('Trans');
  if (lst.length) chips.push(`<chip>Je recherche: ${lst.join(', ')}</chip>`);
  el.innerHTML = chips.length ? chips.join(' ') : '<small>Crée ou complète ton profil.</small>';
}

// Map
let map, meMarker, meCircle;
function initMap(){
  const box = document.getElementById('map');
  if(!box || typeof L==='undefined') return;
  if(map){ map.remove(); }
  map = L.map('map', { zoomControl: true });
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
  map.setView([lat, lon], 15);
  if(meMarker) map.removeLayer(meMarker);
  if(meCircle) map.removeLayer(meCircle);
  meMarker = L.marker([lat, lon]).addTo(map).bindPopup("Vous êtes ici");
  meCircle = L.circle([lat, lon], { radius: r, fillOpacity: .08, color: '#e879f9' }).addTo(map);
}

// Safety
function panic(){
  const msg = 'Besoin d’un check-in. Je suis à un rendez-vous Serendi. Tout va bien ?';
  window.location.href = 'sms:?&body=' + encodeURIComponent(msg);
}

// Settings handlers
function loadSettings(){
  const s = readSettings();
  if($('#quiet') && s.quiet) $('#quiet').value = s.quiet;
  if($('#radius') && s.radius) $('#radius').value = String(s.radius);
}
function saveSettings(){
  const q = $('#quiet')?.value || '';
  const r = Number($('#radius')?.value) || 100;
  writeSettings({ quiet:q, radius:r });
  applyRadius(); initMap(); toast('Réglages enregistrés.');
}

// Bindings
document.addEventListener('DOMContentLoaded', ()=>{
  $('#btn-save-profile')?.addEventListener('click', (e)=>{ e.preventDefault(); saveProfile(); });
  renderSummary();
  loadSettings();
  $('#btn-save-settings')?.addEventListener('click', (e)=>{ e.preventDefault(); saveSettings(); });
  applyRadius(); initMap();
  $('#btn-panic')?.addEventListener('click', panic);
});
