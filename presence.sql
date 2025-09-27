
-- Crée la table des présences (public)
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
create policy "public can insert" on presence for insert with check (expires_at <= now() + interval '60 minutes');
