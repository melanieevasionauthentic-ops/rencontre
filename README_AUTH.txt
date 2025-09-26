# Serendi — build public + comptes (Supabase prêts)

## Étapes
1. Crée un projet sur https://supabase.com → copie `SUPABASE_URL` et `anon key` (Settings → API).
2. Ouvre `auth.js` **et** `supabase-profile.js` et **remplace** les constantes:
   - `https://xxxxx.supabase.co` → ton URL
   - `eyXXXXXXXXXXXXXXXX` → ta ANON KEY
3. Déploie sur GitHub Pages (Settings → Pages) si ce n’est pas déjà fait.
4. Dans `auth.html`, entre un email → reçois le lien → connecté.
5. Va sur `onboarding.html` → **Enregistrer** sauvegarde en ligne si tu es connectée.

## Base de données (Supabase)
Crée deux tables (avec RLS activée):
- `profiles` (id uuid PK réf. auth.users): age, height_cm, hair, body, religion, diet, bio
- `preferences` (user_id uuid PK réf. auth.users): seek_*, want_* etc.
Politiques simples: chaque utilisateur peut lire/écrire **ses** lignes uniquement.

> Tant que tu n’as pas mis tes clés, tout fonctionne en **localStorage** comme avant.