/* Serendi app.js v11 — chemins relatifs, patch carte + enregistrement profil minimal */
const $ = s => document.querySelector(s);
const toast = (m)=>{ const t=$("#toast"); if(!t) return; t.textContent=m; t.classList.add("show"); setTimeout(()=>t.classList.remove("show"),1500); };

// --- PATCH CARTE (indépendant de Supabase) ---
document.addEventListener('DOMContentLoaded', () => {
  try{
    const mapEl = document.getElementById('map');
    if (!mapEl || !window.L) return;
    const map = L.map('map').setView([48.8566, 2.3522], 13); // Paris par défaut
    L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
      maxZoom: 19, attribution: '&copy; OpenStreetMap'
    }).addTo(map);
    window.__SERENDI_MAP = map;
    if (navigator.geolocation) {
      navigator.geolocation.getCurrentPosition(
        pos => map.setView([pos.coords.latitude, pos.coords.longitude], 15),
        () => {}
      );
    }
  }catch(e){ /* on ne bloque pas */ }
});
// --- FIN PATCH CARTE ---

// Helpers profil
function readProfile(){ try{ return JSON.parse(localStorage.getItem('profile')||'{}'); }catch(e){ return {}; } }
function writeProfile(p){ try{ localStorage.setItem('profile', JSON.stringify(p)); }catch(e){} }
function val(sel){ return ($(sel)?.value || '').trim(); }
function multi(sel){ return Array.from($(sel)?.selectedOptions || []).map(o=>o.value); }
function num(sel){ const v = Number(val(sel)); return isFinite(v) ? v : null; }

// Sauvegarde profil (onboarding)
document.addEventListener('DOMContentLoaded', () => {
  const btn = $('#btn-save-profile');
  if (!btn) return;
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
    setTimeout(()=>location.href='index.html', 300);
  });
});

// Affichage résumé (index)
function renderSummary(){
  const box = $('#profile-summary'); if(!box) return;
  const p = readProfile();
  if(!p.display_name){
    box.innerHTML = '<small>Crée ou complète ton profil.</small>';
    return;
  }
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

// Réglages simples (radius)
function readSettings(){ try{ return JSON.parse(localStorage.getItem('settings')||'{}'); }catch(e){ return {}; } }
function writeSettings(s){ try{ localStorage.setItem('settings', JSON.stringify(s)); }catch(e){} }
function getRadius(){ const s = readSettings(); return s.radius || 1000; }
function applyRadiusDisplay(){ const el = document.getElementById('radius-display'); if(el) el.textContent = String(getRadius()); }

document.addEventListener('DOMContentLoaded', () => {
  // index.html : résumé + rayon
  renderSummary(); applyRadiusDisplay();

  // settings.html : sauvegarde
  const btnS = $('#btn-save-settings');
  if (btnS) {
    const rInput = document.getElementById('radius');
    if (rInput) rInput.value = getRadius();
    btnS.addEventListener('click', ()=>{
      const r = Number(document.getElementById('radius')?.value)||1000;
      writeSettings({radius:r});
      toast('Réglages enregistrés.');
      applyRadiusDisplay();
    });
  }
});
