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
create policy proxy_sets_read on public.proxy_sets
  for select using (is_public = true);
create policy proxy_set_cards_read on public.proxy_set_cards
  for select using (
    exists (
      select 1 from public.proxy_sets s
      where s.id = set_id and s.is_public = true
    )
  );

-- Signed-in users can manage sets they created.
create policy proxy_sets_write on public.proxy_sets
  for all using (auth.uid() = created_by) with check (auth.uid() = created_by);
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

insert into public.proxy_sets (name, code, description, is_public)
values ('Proxy Set', 'PROXY', 'Shared proxy art. Images are hosted on Cloudflare.', true)
on conflict (code) do nothing;
