
const $ = sel => document.querySelector(sel);
const toast = (msg) => { const t = $('#toast'); if(!t) return; t.textContent = msg; t.classList.add('show'); setTimeout(()=>t.classList.remove('show'), 2400); };
const readProfile = () => { try { return JSON.parse(localStorage.getItem('profile') || '{}'); } catch(e){ return {}; } };
const writeProfile = (data) => localStorage.setItem('profile', JSON.stringify(data));
const saveProfile = () => {
  const data = {
    age: $('#age')?.value || null, height: $('#height')?.value || null,
    hair: $('#hair')?.value || null, body: $('#body')?.value || null,
    religion: $('#religion')?.value || '', diet: $('#diet')?.value || '',
    tags: $('#tags')?.value || '', pref: ($('#pref') && Array.from($('#pref').selectedOptions).map(o=>o.value)) || [],
    range: $('#range')?.value || null, pref_same_religion: $('#pref_same_religion')?.checked || false,
    pref_same_diet: $('#pref_same_diet')?.checked || false,
  }; writeProfile(data); toast('Profil enregistré localement.'); renderSummary();
};
const clearAll = () => { localStorage.clear(); toast('Données locales effacées.'); setTimeout(()=>location.reload(), 700); };
let available = false, proxCount = 0, acceptedA = false, acceptedB = false;
const setAvailable = (on) => { available = on; toast(on ? 'Disponible pendant 60 min (démo)' : 'Indisponible'); };
const simulateProximity = () => {
  if(!available){ toast('Active “Disponible” d’abord.'); return; }
  const p = readProfile(); const fRel = $('#filter_same_religion')?.checked; const fDiet = $('#filter_same_diet')?.checked;
  if ((fRel && !p.religion) || (fDiet && !p.diet)) { toast('Aucun(e) compatible sous ces filtres (démo).'); return; }
  proxCount += 1; const el = $('#prox-count .v'); if (el) el.textContent = String(proxCount); toast('Quelqu’un de compatible est proche (~100 m).');
};
const accept = () => { if(!available){ toast('Active “Disponible” d’abord.'); return; } acceptedA = true; maybeCreateMeet(); };
const decline = () => { acceptedA = false; acceptedB = false; const mc = $('#meet-card'); if (mc) mc.innerHTML = '<p class="notice">Invitation refusée. On se recroisera.</p>'; };
const maybeCreateMeet = () => {
  acceptedB = true; const poi = pickPOIs(); const code = makeCode(); const p = readProfile();
  const details = [p.age && `Âge: ${p.age}`, p.height && `Taille: ${p.height} cm`, p.hair && `Cheveux: ${p.hair}`, p.body && `Corps: ${p.body}`, p.religion && `Religion: ${p.religion}`, p.diet && `Régime: ${p.diet}`].filter(Boolean).join(' • ');
  const mc = $('#meet-card'); if (mc) mc.innerHTML = `<h2>Point de rencontre</h2><p>Choisissez un de ces lieux publics à mi-chemin :</p><ul><li>${poi[0]}</li><li>${poi[1]}</li><li>${poi[2]}</li></ul><div class='code mono'>Code de reconnaissance: <strong>${code}</strong> (expire dans 15 min)</div><p class='notice'>Votre résumé (démo): ${details || '—'}</p><p class='notice'>Pas de chat. Allez vous dire bonjour directement.</p>`; toast('Point de rencontre créé.');
};
const pickPOIs = () => { const o = ["Entrée principale du Parc Central","Devant le Café Horizon (terrasse)","Station Vélo – Place des Arts","Fontaine du Square Victor","Hall du Musée (entrée billetterie)"]; return o.sort(()=>Math.random()-0.5).slice(0,3); };
const makeCode = () => { const a = ["Ambre","Sienne","Corail","Rose","Curry","Cacao","Indigo"]; const n = Math.floor(100+Math.random()*900); return `${a[Math.floor(Math.random()*a.length)]}-${n}`; };
const panic = () => { const url = 'sms:?&body=' + encodeURIComponent('Besoin d’un check-in. Je suis à un rendez-vous. Tout va bien ?'); location.href = url; };
const renderSummary = () => {
  const el = $('#profile-summary'); if(!el) return; const p = readProfile(); const chips = [];
  if (p.age) chips.push(`<chip>Âge ${p.age}</chip>`); if (p.height) chips.push(`<chip>${p.height} cm</chip>`);
  if (p.hair) chips.push(`<chip>Cheveux ${p.hair}</chip>`); if (p.body) chips.push(`<chip>Corps ${p.body}</chip>`);
  if (p.religion) chips.push(`<chip>Religion ${p.religion}</chip>`); if (p.diet) chips.push(`<chip>Régime ${p.diet}</chip>`);
  if (p.tags) chips.push(`<chip>Tags: ${p.tags}</chip>`); el.innerHTML = chips.length ? chips.join(' ') : '<small>Aucun profil sauvegardé pour l’instant.</small>';
};
document.addEventListener('DOMContentLoaded', () => {
  $('#btn-save-profile')?.addEventListener('click', saveProfile); $('#btn-clear')?.addEventListener('click', clearAll);
  $('#btn-available')?.addEventListener('click', () => { setAvailable(!available); });
  $('#btn-stealth')?.addEventListener('click', () => { setAvailable(false); toast('Stealth activé (démo)'); });
  $('#btn-simulate')?.addEventListener('click', simulateProximity);
  $('#btn-accept')?.addEventListener('click', accept); $('#btn-decline')?.addEventListener('click', decline);
  $('#btn-panic')?.addEventListener('click', panic); renderSummary();
});
