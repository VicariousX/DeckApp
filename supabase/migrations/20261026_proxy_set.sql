-- Proxy set: shared proxy art, hosted on Cloudflare, available to all users.
create table if not exists public.proxy_sets (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  code text not null unique,
  description text,
  is_public boolean not null default true,
  created_by uuid references auth.users(id) on delete set null,
  created_at timestamptz not null default now()
);

create table if not exists public.proxy_set_cards (
  id uuid primary key default gen_random_uuid(),
  set_id uuid not null references public.proxy_sets(id) on delete cascade,
  oracle_id text not null,
  name text not null,
  image_url text not null,
  back_image_url text,
  created_at timestamptz not null default now(),
  unique (set_id, oracle_id)
);

create index if not exists proxy_set_cards_oracle_idx on public.proxy_set_cards (oracle_id);
create index if not exists proxy_set_cards_set_idx on public.proxy_set_cards (set_id);

alter table public.proxy_sets enable row level security;
alter table public.proxy_set_cards enable row level security;

-- Anyone can read public sets and their cards.
drop policy if exists proxy_sets_read on public.proxy_sets;
create policy proxy_sets_read on public.proxy_sets
  for select using (is_public = true);

drop policy if exists proxy_set_cards_read on public.proxy_set_cards;
create policy proxy_set_cards_read on public.proxy_set_cards
  for select using (
    exists (
      select 1 from public.proxy_sets s
      where s.id = set_id and s.is_public = true
    )
  );

-- Signed-in users can manage sets they created.
drop policy if exists proxy_sets_write on public.proxy_sets;
create policy proxy_sets_write on public.proxy_sets
  for all using (auth.uid() = created_by) with check (auth.uid() = created_by);

drop policy if exists proxy_set_cards_write on public.proxy_set_cards;
create policy proxy_set_cards_write on public.proxy_set_cards
  for all using (
    exists (
      select 1 from public.proxy_sets s
      where s.id = set_id and s.created_by = auth.uid()
    )
  ) with check (
    exists (
      select 1 from public.proxy_sets s
      where s.id = set_id and s.created_by = auth.uid()
    )
  );

-- Grants so client roles can use the tables under RLS.
grant select, insert, update, delete on public.proxy_sets to authenticated;
grant select on public.proxy_sets to anon;
grant select, insert, update, delete on public.proxy_sets to service_role;

grant select, insert, update, delete on public.proxy_set_cards to authenticated;
grant select on public.proxy_set_cards to anon;
grant select, insert, update, delete on public.proxy_set_cards to service_role;

-- Default PROXY set is created by the first admin visit so they own it (created_by set).
