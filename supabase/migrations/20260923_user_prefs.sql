-- Per-user JSON prefs (search token drawer, etc.)
create table if not exists public.user_prefs (
  user_id uuid primary key references auth.users (id) on delete cascade,
  search_tokens jsonb not null default '[]'::jsonb,
  updated_at timestamptz not null default timezone('utc'::text, now())
);

alter table public.user_prefs enable row level security;

drop policy if exists "Users read own prefs" on public.user_prefs;
create policy "Users read own prefs"
  on public.user_prefs for select to authenticated
  using (auth.uid() = user_id);

drop policy if exists "Users insert own prefs" on public.user_prefs;
create policy "Users insert own prefs"
  on public.user_prefs for insert to authenticated
  with check (auth.uid() = user_id);

drop policy if exists "Users update own prefs" on public.user_prefs;
create policy "Users update own prefs"
  on public.user_prefs for update to authenticated
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

drop policy if exists "Users delete own prefs" on public.user_prefs;
create policy "Users delete own prefs"
  on public.user_prefs for delete to authenticated
  using (auth.uid() = user_id);

grant select, insert, update, delete on table public.user_prefs to authenticated;
