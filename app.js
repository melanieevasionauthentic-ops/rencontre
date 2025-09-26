
const $ = sel => document.querySelector(sel);
const toast = (msg) => { const t = $('#toast'); if(!t) return; t.textContent = msg; t.classList.add('show'); setTimeout(()=>t.classList.remove('show'), 2400); };

const readProfile = () => { try { return JSON.parse(localStorage.getItem('profile') || '{}'); } catch(e){ return {}; } };
const writeProfile = (data) => localStorage.setItem('profile', JSON.stringify(data));

const saveProfile = () => {
  const data = {
    // Me
    age: num($('#age')?.value),
    height: num($('#height')?.value),
    hair: $('#hair')?.value || '',
    body: $('#body')?.value || '',
    religion: $('#religion')?.value || '',
    diet: $('#diet')?.value || '',
    bio: ($('#bio')?.value || '').slice(0,2400),
    // Seeking
    seek: {
      women: $('#seek_women')?.checked || false,
      men: $('#seek_men')?.checked || false,
      nb: $('#seek_nb')?.checked || false,
      trans: $('#seek_trans')?.checked || false,
    },
    orientation: ($('#orientation') && Array.from($('#orientation').selectedOptions).map(o=>o.value)) || [],
    want: {
      age: [num($('#want_age_min')?.value), num($('#want_age_max')?.value)],
      height: [num($('#want_h_min')?.value), num($('#want_h_max')?.value)],
      hair: ($('#want_hair') && Array.from($('#want_hair').selectedOptions).map(o=>o.value)) || [],
      body: ($('#want_body') && Array.from($('#want_body').selectedOptions).map(o=>o.value)) || [],
      same_religion: $('#want_same_religion')?.checked || false,
      same_diet: $('#want_same_diet')?.checked || false,
    },
    tags: $('#tags')?.value || '',
  };
  writeProfile(data);
  toast('Profil enregistré localement.');
  renderSummary();
};

const clearAll = () => { localStorage.clear(); toast('Données locales effacées.'); setTimeout(()=>location.reload(), 700); };
const num = (v) => { const n = Number(v); return isFinite(n) ? n : null; };

let disponible = false, proxCount = 0;

const setDisponible = (on) => {
  disponible = on;
  toast(on ? 'Vous êtes disponible pendant 60 min (démo).' : 'Indisponible.');
};

// ---- Matching demo: create a mock candidate and check against user's 'want' ----
const HAIRS = ["Châtains","Bruns","Blonds","Roux","Noirs","Autre"];
const BODIES = ["Sportif(ve)","Mince","Normal","Avec formes","Grand(e)","Autre"];
const GENDERS = ["Femmes","Hommes","Non binaires","Trans"];

const simulateProximity = () => {
  if(!disponible){ toast('Activez “Disponible” d’abord.'); return; }
  const me = readProfile();
  // Build mock candidate
  const candidate = {
    gender: GENDERS[Math.floor(Math.random()*GENDERS.length)],
    age: 18 + Math.floor(Math.random()*40),
    height: 150 + Math.floor(Math.random()*50),
    hair: HAIRS[Math.floor(Math.random()*HAIRS.length)],
    body: BODIES[Math.floor(Math.random()*BODIES.length)],
    religion: Math.random()<0.5 ? me.religion : "",
    diet: Math.random()<0.5 ? me.diet : "",
    bio: "Aime flâner au marché, partant·e pour un café court. Tenue: veste bleue."
  };

  // Check user's seeks
  const seeks = me.seek || {};
  const gendersOk = (seeks.women && candidate.gender==="Femmes")
    || (seeks.men && candidate.gender==="Hommes")
    || (seeks.nb && candidate.gender==="Non binaires")
    || (seeks.trans && candidate.gender==="Trans");
  if(!gendersOk){ toast("Quelqu’un est proche, mais hors de vos genres recherchés (démo)."); return; }

  const want = me.want || {};
  const inRange = (val, [min,max]) => {
    if(min==null && max==null) return true;
    if(min!=null && val<min) return false;
    if(max!=null && val>max) return false;
    return true;
  };
  const setOk = (val, set) => (!set || set.length===0 || set.includes(val));

  if(!inRange(candidate.age, want.age||[null,null])) { toast("Proche mais âge hors de vos critères (démo)."); return; }
  if(!inRange(candidate.height, want.height||[null,null])) { toast("Proche mais taille hors de vos critères (démo)."); return; }
  if(!setOk(candidate.hair, want.hair)) { toast("Proche mais cheveux hors de vos critères (démo)."); return; }
  if(!setOk(candidate.body, want.body)) { toast("Proche mais type de corps hors de vos critères (démo)."); return; }
  if(want.same_religion && me.religion && candidate.religion !== me.religion){ toast("Proche mais religion différente (démo)."); return; }
  if(want.same_diet && me.diet && candidate.diet !== me.diet){ toast("Proche mais régime différent (démo)."); return; }

  // If passed, show chips + bio
  proxCount += 1; const el = $('#prox-count .v'); if (el) el.textContent = String(proxCount);
  const chips = [];
  chips.push(`<chip>${candidate.gender}</chip>`);
  chips.push(`<chip>Âge ${candidate.age}</chip>`);
  chips.push(`<chip>${candidate.height} cm</chip>`);
  chips.push(`<chip>Cheveux ${candidate.hair}</chip>`);
  chips.push(`<chip>Corps ${candidate.body}</chip>`);
  $('#nearby-chips').innerHTML = chips.join(' ');
  $('#nearby-desc').textContent = candidate.bio;
  toast('Quelqu’un de compatible est tout près (~100 m).');
};

const rendreDiscret = () => { setDisponible(false); toast('Pause activée 3 h (démo).'); };

const accepter = () => {
  if(!disponible){ toast('Activez “Disponible” d’abord.'); return; }
  const mc = $('#meet-card');
  mc.innerHTML = `
    <h2>Point de rencontre</h2>
    <p>Choisissez un lieu public à mi-chemin :</p>
    <ul>
      <li>Entrée principale du Parc Central</li>
      <li>Devant le Café Horizon (terrasse)</li>
      <li>Fontaine du Square Victor</li>
    </ul>
    <p><b>Décrivez votre tenue pour vous reconnaître</b> (ex. “manteau rouge”, “robe noire”, “veste bleue”).</p>
    <div class="row">
      <input id="desc-tenue" placeholder="Ex. manteau rouge">
      <button class="btn" id="btn-share-desc">Partager ma description</button>
    </div>
    <div id="desc-status" class="notice" style="margin-top:8px"></div>
    <p class="notice">Pas de chat dans l’app. Allez vous dire bonjour directement.</p>
  `;
  $('#btn-share-desc')?.addEventListener('click', partagerDesc);
  toast('Rencontre prête. Ajoutez votre description.');
};

const refuser = () => { $('#meet-card').innerHTML = '<p class="notice">Invitation refusée. À une prochaine fois.</p>'; };

const partagerDesc = () => {
  const val = ($('#desc-tenue')?.value || '').trim();
  if (!val){ toast('Ajoutez une courte description (ex. “manteau rouge”).'); return; }
  $('#desc-status').innerHTML = `Description partagée : <b>${val}</b>. En attente de l’autre personne… (démo)`;
  toast('Description envoyée (démo).');
};

const panic = () => { const url = 'sms:?&body=' + encodeURIComponent('Besoin d’un check-in. Je suis à un rendez-vous. Tout va bien ?'); location.href = url; };

// Summary renderer
const renderSummary = () => {
  const el = $('#profile-summary'); if(!el) return;
  const p = readProfile();
  const chips = [];
  if (p.age) chips.push(`<chip>Âge ${p.age}</chip>`);
  if (p.height) chips.push(`<chip>${p.height} cm</chip>`);
  if (p.hair) chips.push(`<chip>Cheveux ${p.hair}</chip>`);
  if (p.body) chips.push(`<chip>Corps ${p.body}</chip>`);
  if (p.religion) chips.push(`<chip>Religion ${p.religion}</chip>`);
  if (p.diet) chips.push(`<chip>Régime ${p.diet}</chip>`);
  if (p.tags) chips.push(`<chip>Tags: ${p.tags}</chip>`);
  const seeks = Object.entries(p.seek || {}).filter(([k,v])=>v).map(([k])=>({women:"Femmes",men:"Hommes",nb:"Non binaires",trans:"Trans"}[k]));
  if (seeks.length) chips.push(`<chip>Je recherche: ${seeks.join(', ')}</chip>`);
  const want = p.want || {};
  if (want.age && (want.age[0] || want.age[1])) chips.push(`<chip>Âge souhaité: ${want.age[0]||'…'}–${want.age[1]||'…'}</chip>`);
  if (want.height && (want.height[0] || want.height[1])) chips.push(`<chip>Taille souhaitée: ${want.height[0]||'…'}–${want.height[1]||'…'} cm</chip>`);
  if ((want.hair||[]).length) chips.push(`<chip>Cheveux: ${want.hair.join(', ')}</chip>`);
  if ((want.body||[]).length) chips.push(`<chip>Corps: ${want.body.join(', ')}</chip>`);
  if (want.same_religion) chips.push(`<chip>Même religion</chip>`);
  if (want.same_diet) chips.push(`<chip>Même régime</chip>`);
  el.innerHTML = chips.length ? chips.join(' ') : '<small>Aucun profil sauvegardé pour l’instant.</small>';
};

document.addEventListener('DOMContentLoaded', () => {
  $('#btn-save-profile')?.addEventListener('click', saveProfile);
  $('#btn-clear')?.addEventListener('click', clearAll);
  $('#btn-available')?.addEventListener('click', () => setDisponible(!disponible));
  $('#btn-stealth')?.addEventListener('click', () => { setDisponible(false); toast('Pause activée 3 h (démo).'); });
  $('#btn-simulate')?.addEventListener('click', simulateProximity);
  $('#btn-accept')?.addEventListener('click', accepter);
  $('#btn-decline')?.addEventListener('click', refuser);
  $('#btn-panic')?.addEventListener('click', panic);
  renderSummary();
});
