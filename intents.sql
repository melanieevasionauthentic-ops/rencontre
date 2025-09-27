create extension if not exists pgcrypto;
create table if not exists public.intents (
  id uuid primary key default gen_random_uuid(),
  target_presence_id uuid not null,
  from_name text not null,
  created_at timestamptz not null default now()
);
alter table public.intents enable row level security;
create policy if not exists "anon can insert intents" on public.intents for insert to anon with check (true);
create policy if not exists "anon can read intents"   on public.intents for select to anon using (true);
