-- Public card backs uploaded from the profile Card skins tab.
create table if not exists public.user_card_skins (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  name text not null,
  storage_path text not null,
  is_public boolean not null default false,
  created_at timestamptz not null default now()
);

alter table public.user_card_skins enable row level security;

drop policy if exists user_card_skins_owner on public.user_card_skins;
create policy user_card_skins_owner on public.user_card_skins
  for all using (auth.uid() = user_id) with check (auth.uid() = user_id);

drop policy if exists user_card_skins_public_read on public.user_card_skins;
create policy user_card_skins_public_read on public.user_card_skins
  for select using (is_public = true);

grant select, insert, update, delete on public.user_card_skins to authenticated;
grant select on public.user_card_skins to anon;
grant select, insert, update, delete on public.user_card_skins to service_role;
