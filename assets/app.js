
const $ = s => document.querySelector(s);
const toast = (m)=>{const t=$('#toast'); if(!t) return; t.textContent=m; t.classList.add('show'); setTimeout(()=>t.classList.remove('show'),2000);};

// Settings (local)
const readSettings = () => { try{return JSON.parse(localStorage.getItem('settings')||'{}')}catch(e){return{}} };
const writeSettings = (s) => localStorage.setItem('settings', JSON.stringify(s));

// Radius display
const getRadius = ()=> (readSettings().radius || 100);
const applyRadius = ()=>{ const el = document.getElementById('radius-display'); if(el) el.textContent = String(getRadius()); };

// Leaflet map
let map, meMarker, meCircle;
function initMap(){
  const box = document.getElementById('map');
  if(!box || typeof L==='undefined') return;
  map = L.map('map', { zoomControl: true });
  const tiles = L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
    maxZoom: 19, attribution: '&copy; OpenStreetMap'
  });
  tiles.addTo(map);

  if (navigator.geolocation) {
    navigator.geolocation.getCurrentPosition((pos)=>{
      renderPosition(pos.coords.latitude, pos.coords.longitude);
    }, ()=>{
      renderPosition(48.8566, 2.3522);
      toast("Géolocalisation refusée. Paris par défaut.");
    });
  } else {
    renderPosition(48.8566, 2.3522);
  }
}
function renderPosition(lat, lon){
  const r = getRadius();
  if(!map) return;
  map.setView([lat, lon], 15);
  if(meMarker) map.removeLayer(meMarker);
  if(meCircle) map.removeLayer(meCircle);
  meMarker = L.marker([lat, lon]).addTo(map).bindPopup("Vous êtes ici");
  meCircle = L.circle([lat, lon], { radius: r, fillOpacity: .08, color: '#e879f9' }).addTo(map);
}

document.addEventListener('DOMContentLoaded', ()=>{
  applyRadius();
  initMap();
  $('#btn-save-settings')?.addEventListener('click', ()=>{
    const q = $('#quiet')?.value || '';
    const r = Number($('#radius')?.value) || 100;
    writeSettings({ quiet:q, radius:r });
    applyRadius();
    initMap();
    toast('Réglages enregistrés.');
  });
});
