create table if not exists public.collection_cards (
  id uuid primary key default gen_random_uuid(),
  collection_id uuid not null references public.collections (id) on delete cascade,
  oracle_id uuid not null,
  scryfall_id uuid,
  identity text not null,
  name text not null default '',
  image_url text,
  quantity integer not null default 1,
  created_at timestamptz not null default timezone('utc'::text, now()),
  updated_at timestamptz not null default timezone('utc'::text, now()),
  constraint collection_cards_identity unique (collection_id, identity)
);

create index if not exists collection_cards_collection_idx on public.collection_cards (collection_id);

alter table public.collection_cards enable row level security;

drop policy if exists "Users read own collection cards" on public.collection_cards;
create policy "Users read own collection cards"
  on public.collection_cards for select to authenticated
  using (exists (select 1 from public.collections c where c.id = collection_id and (c.user_id = auth.uid() or c.is_public)));

drop policy if exists "Users insert own collection cards" on public.collection_cards;
create policy "Users insert own collection cards"
  on public.collection_cards for insert to authenticated
  with check (exists (select 1 from public.collections c where c.id = collection_id and c.user_id = auth.uid()));

drop policy if exists "Users update own collection cards" on public.collection_cards;
create policy "Users update own collection cards"
  on public.collection_cards for update to authenticated
  using (exists (select 1 from public.collections c where c.id = collection_id and c.user_id = auth.uid()))
  with check (exists (select 1 from public.collections c where c.id = collection_id and c.user_id = auth.uid()));

drop policy if exists "Users delete own collection cards" on public.collection_cards;
create policy "Users delete own collection cards"
  on public.collection_cards for delete to authenticated
  using (exists (select 1 from public.collections c where c.id = collection_id and c.user_id = auth.uid()));

grant select, insert, update, delete on table public.collection_cards to authenticated;
