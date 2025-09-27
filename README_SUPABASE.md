
# Serendi — Jekyll v3 (mobile + radar temps réel + Supabase facile)

## 1) Brancher Supabase (radar)
- Crée un projet sur https://supabase.com
- Va dans **Settings → API** et copie **Project URL** + **anon public**.
- Ouvre `assets/config.js` et **remplace**:
  - `SUPABASE_URL`
  - `SUPABASE_ANON`

### Créer la table `presence`
Dans Supabase → SQL → exécute :
```sql
create table if not exists presence (
  id uuid primary key default gen_random_uuid(),
  lat double precision not null,
  lon double precision not null,
  radius_m integer not null check (radius_m between 50 and 1000),
  bio_short text,
  updated_at timestamptz not null default now(),
  expires_at timestamptz not null
);
alter table presence enable row level security;
create policy "public can read active" on presence for select using (expires_at > now());
create policy "public can insert" on presence for insert with check (expires_at <= now() + interval '10 minutes');
```

## 2) Déployer sur GitHub Pages
- Repo → Settings → Pages → Source = `main` / root.
- Pousse `serendi-jekyll-v3` entier.

## 3) Nom de domaine
- Achète un domaine (OVH, Google Domains, Cloudflare…).
- Sur le registrar: crée un CNAME `www` → `tonpseudo.github.io`.
- Dans ton repo GitHub → Settings → Pages → Custom domain: mets `www.tondomaine.com`.
- Ajoute un fichier `CNAME` à la racine contenant **exactement** `www.tondomaine.com`.

## 4) Monétisation (sans abonnement)
- Liens **Stripe Payment Links** pour un **Pass Journée** / **Boost**.
- Partenariats **lieux sûrs** (mise en avant).
- Billetterie **événements**.
- **Vérification unique** (badge).
- **Tip** volontaire.

## 5) Anti‑copie / protection
- Dépose **la marque** “Serendi” (INPI).
- Ajoute un fichier `LICENSE` (ex: “All rights reserved”).
- Cache des détails serveurs (limites, heuristiques).

## 6) À vérifier après mise en ligne
- Autoriser la géolocalisation.
- Tester avec 2 téléphones proches: le compteur **Proximités** doit augmenter.
- Régler le **rayon** dans Réglages.
