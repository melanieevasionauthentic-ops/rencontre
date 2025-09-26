// --- Supabase Auth (renseigner les constantes ci-dessous) ---
const SUPABASE_URL = "https://xxxxx.supabase.co";       // <-- remplace
const SUPABASE_ANON = "eyXXXXXXXXXXXXXXXXXXXXXXXXX";    // <-- remplace

if (!window.supabase) { console.error("Supabase SDK non chargé"); }
const sb = window.supabase?.createClient(SUPABASE_URL, SUPABASE_ANON);
const $ = (s) => document.querySelector(s);
const statusEl = () => $('#auth-status');

async function showSession() {
  if (!sb) { statusEl().textContent = "Configurer Supabase pour activer les comptes."; return; }
  const { data: { session } } = await sb.auth.getSession();
  statusEl().textContent = session ? `Connecté: ${session.user.email}` : "Non connecté.";
}

$('#btn-login')?.addEventListener('click', async () => {
  if (!sb) { statusEl().textContent = "Supabase non configuré."; return; }
  const email = $('#email').value.trim();
  if(!email){ statusEl().textContent = "Ajoute un email."; return; }
  const { error } = await sb.auth.signInWithOtp({
    email,
    options:{ emailRedirectTo: window.location.origin + '/index.html' }
  });
  statusEl().textContent = error ? ("Erreur: " + error.message) : "Lien envoyé. Vérifie tes emails.";
});

$('#btn-logout')?.addEventListener('click', async () => {
  if (!sb) return;
  await sb.auth.signOut();
  statusEl().textContent = "Déconnecté.";
});

document.addEventListener('DOMContentLoaded', showSession);
