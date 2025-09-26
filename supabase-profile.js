// --- Sauvegarde du profil en ligne (Supabase) ---
// Renseigne d'abord SUPABASE_URL et SUPABASE_ANON dans ce fichier.
const SUPABASE_URL_P = "https://xxxxx.supabase.co";     // <-- remplace
const SUPABASE_ANON_P = "eyXXXXXXXXXXXXXXXXXXXXXXXXX";  // <-- remplace

let sbp = null;
if (window.supabase && SUPABASE_URL_P.includes("https://xxxxx") === false) {
  sbp = window.supabase.createClient(SUPABASE_URL_P, SUPABASE_ANON_P);
}

async function getUserId() {
  if (!sbp) return null;
  const { data: { session } } = await sbp.auth.getSession();
  return session?.user?.id || null;
}

// Cette fonction remplace saveProfile() si Supabase est configuré
async function saveProfileOnline() {
  const uid = await getUserId();
  if (!uid) {
    alert("Connecte-toi (menu Compte) pour sauvegarder en ligne.");
    return;
  }
  // Récupérer les champs du formulaire (mêmes ids que l’UI existante)
  const val = (sel) => document.querySelector(sel)?.value || "";
  const num = (sel) => { const v = Number(document.querySelector(sel)?.value); return isFinite(v) ? v : null; };
  const checked = (sel) => document.querySelector(sel)?.checked || false;
  const multi = (sel) => Array.from(document.querySelector(sel)?.selectedOptions || []).map(o=>o.value);

  const profile = {
    id: uid,
    age: num('#age'),
    height_cm: num('#height'),
    hair: val('#hair'),
    body: val('#body'),
    religion: val('#religion'),
    diet: val('#diet'),
    bio: (val('#bio') || '').slice(0,2400),
  };
  const preferences = {
    user_id: uid,
    seek_women: checked('#seek_women'),
    seek_men: checked('#seek_men'),
    seek_nb: checked('#seek_nb'),
    seek_trans: checked('#seek_trans'),
    want_age_min: num('#want_age_min'),
    want_age_max: num('#want_age_max'),
    want_h_min: num('#want_h_min'),
    want_h_max: num('#want_h_max'),
    want_hair: multi('#want_hair'),
    want_body: multi('#want_body'),
    same_religion: checked('#want_same_religion'),
    same_diet: checked('#want_same_diet'),
  };

  // Upsert
  const up1 = await sbp.from('profiles').upsert(profile);
  if (up1.error) { alert("Erreur profil: " + up1.error.message); return; }
  const up2 = await sbp.from('preferences').upsert(preferences);
  if (up2.error) { alert("Erreur préférences: " + up2.error.message); return; }

  alert("Profil sauvegardé en ligne ✅");
}

// Si Supabase est configuré, on remplace le clic du bouton par saveProfileOnline
document.addEventListener('DOMContentLoaded', () => {
  if (!sbp) return;
  const btn = document.querySelector('#btn-save-profile');
  if (btn) {
    btn.removeEventListener('click', window.saveProfile); // au cas où
    btn.addEventListener('click', (e) => { e.preventDefault(); saveProfileOnline(); });
  }
});
