
const $ = sel => document.querySelector(sel);
const toast = (msg) => { const t = $('#toast'); if(!t) return; t.textContent = msg; t.classList.add('show'); setTimeout(()=>t.classList.remove('show'), 2500); };

const saveProfile = () => {
  const data = {
    age: $('#age')?.value || null,
    height: $('#height')?.value || null,
    hair: $('#hair')?.value || null,
    body: $('#body')?.value || null,
    tags: $('#tags')?.value || null,
    pref: ($('#pref') && Array.from($('#pref').selectedOptions).map(o=>o.value)) || [],
    range: $('#range')?.value || null
  };
  localStorage.setItem('profile', JSON.stringify(data));
  toast('Profil enregistré localement.');
}

const clearAll = () => {
  localStorage.clear();
  toast('Données locales effacées.');
  setTimeout(()=>location.reload(), 800);
}

let available = false;
let proxCount = 0;
let acceptedA = false, acceptedB = false;

const setAvailable = (on) => {
  available = on;
  toast(on ? 'Disponible pendant 60 min (démo)' : 'Indisponible');
}

const simulateProximity = () => {
  if(!available){ toast('Active “Disponible” d’abord.'); return; }
  proxCount += 1;
  const el = $('#prox-count .v'); if (el) el.textContent = String(proxCount);
  toast('Quelqu’un de compatible est proche (~100 m).');
}

const accept = () => {
  if(!available){ toast('Active “Disponible” d’abord.'); return; }
  acceptedA = true; maybeCreateMeet();
}
const decline = () => {
  acceptedA = false; acceptedB = false;
  const mc = $('#meet-card');
  if (mc) mc.innerHTML = '<p class="notice">Invitation refusée. On se recroisera.</p>';
}
const maybeCreateMeet = () => {
  acceptedB = true;
  const poi = pickPOIs();
  const code = makeCode();
  const mc = $('#meet-card');
  if (mc) mc.innerHTML = `
    <h2>Point de rencontre</h2>
    <p>Choisissez un de ces lieux publics à mi-chemin :</p>
    <ul><li>${poi[0]}</li><li>${poi[1]}</li><li>${poi[2]}</li></ul>
    <div class="code mono">Code de reconnaissance: <strong>${code}</strong> (expire dans 15 min)</div>
    <p class="notice">Pas de chat. Allez vous dire bonjour directement.</p>`;
  toast('Point de rencontre créé.');
}

const pickPOIs = () => {
  const options = [
    "Entrée principale du Parc Central",
    "Devant le Café Horizon (terrasse)",
    "Station Vélo – Place des Arts",
    "Fontaine du Square Victor",
    "Hall du Musée (entrée billetterie)"
  ];
  const shuffled = options.sort(()=>Math.random()-0.5);
  return shuffled.slice(0,3);
}
const makeCode = () => {
  const adj = ["Bleu","Vert","Ambre","Indigo","Sable","Argent","Bois"];
  const n = Math.floor(100+Math.random()*900);
  return `${adj[Math.floor(Math.random()*adj.length)]}-${n}`;
}

const panic = () => {
  const url = 'sms:?&body=' + encodeURIComponent('Besoin d’un check-in. Je suis à un rendez-vous. Tout va bien ?');
  location.href = url;
}

const requestGeo = () => {
  if (!navigator.geolocation) { toast('Géolocalisation non supportée.'); return; }
  navigator.geolocation.getCurrentPosition(
    () => toast('Position obtenue (démo, non stockée).'),
    () => toast('Impossible d’obtenir la position.'),
    { enableHighAccuracy: false, timeout: 5000 }
  );
}

document.addEventListener('DOMContentLoaded', () => {
  $('#btn-save-profile')?.addEventListener('click', saveProfile);
  $('#btn-clear')?.addEventListener('click', clearAll);
  $('#btn-available')?.addEventListener('click', () => { setAvailable(!available); requestGeo(); });
  $('#btn-stealth')?.addEventListener('click', () => { setAvailable(false); toast('Stealth activé (démo)'); });
  $('#btn-simulate')?.addEventListener('click', simulateProximity);
  $('#btn-accept')?.addEventListener('click', accept);
  $('#btn-decline')?.addEventListener('click', decline);
  $('#btn-panic')?.addEventListener('click', panic);
});
