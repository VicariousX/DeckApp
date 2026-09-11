-- DeckApp: decks, cards in decks, deck-specific tags

-- ---------------------------------------------------------------------------
-- decks
-- ---------------------------------------------------------------------------
create table if not exists public.decks (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade default auth.uid(),
  name text not null,
  description text not null default '',
  format text not null default 'casual',
  is_public boolean not null default false,
  created_at timestamptz not null default timezone('utc'::text, now()),
  updated_at timestamptz not null default timezone('utc'::text, now())
);

create index if not exists decks_user_id_idx on public.decks (user_id);
create index if not exists decks_is_public_idx on public.decks (is_public) where is_public = true;

create or replace function public.set_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

drop trigger if exists decks_set_updated_at on public.decks;
create trigger decks_set_updated_at
  before update on public.decks
  for each row
  execute function public.set_updated_at();

alter table public.decks enable row level security;

drop policy if exists "Users read own decks" on public.decks;
create policy "Users read own decks"
  on public.decks for select to authenticated
  using (auth.uid() = user_id);

drop policy if exists "Anyone read public decks" on public.decks;
create policy "Anyone read public decks"
  on public.decks for select to anon, authenticated
  using (is_public = true);

drop policy if exists "Users insert own decks" on public.decks;
create policy "Users insert own decks"
  on public.decks for insert to authenticated
  with check (auth.uid() = user_id);

drop policy if exists "Users update own decks" on public.decks;
create policy "Users update own decks"
  on public.decks for update to authenticated
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

drop policy if exists "Users delete own decks" on public.decks;
create policy "Users delete own decks"
  on public.decks for delete to authenticated
  using (auth.uid() = user_id);

grant select, insert, update, delete on table public.decks to authenticated;
grant select on table public.decks to anon;

-- ---------------------------------------------------------------------------
-- deck_cards
-- ---------------------------------------------------------------------------
create table if not exists public.deck_cards (
  id uuid primary key default gen_random_uuid(),
  deck_id uuid not null references public.decks (id) on delete cascade,
  oracle_id uuid not null,
  scryfall_id uuid not null,
  name text not null,
  type_line text not null default '',
  mana_cost text,
  cmc numeric,
  quantity int not null default 1 check (quantity > 0),
  board text not null default 'main'
    check (board in ('main', 'side', 'maybe', 'commander')),
  notes text,
  created_at timestamptz not null default timezone('utc'::text, now()),
  updated_at timestamptz not null default timezone('utc'::text, now()),
  constraint deck_cards_unique_entry unique (deck_id, scryfall_id, board)
);

create index if not exists deck_cards_deck_id_idx on public.deck_cards (deck_id);
create index if not exists deck_cards_oracle_id_idx on public.deck_cards (oracle_id);

drop trigger if exists deck_cards_set_updated_at on public.deck_cards;
create trigger deck_cards_set_updated_at
  before update on public.deck_cards
  for each row
  execute function public.set_updated_at();

alter table public.deck_cards enable row level security;

-- Owner of parent deck may CRUD
drop policy if exists "Users manage cards in own decks" on public.deck_cards;
create policy "Users manage cards in own decks"
  on public.deck_cards for all to authenticated
  using (
    exists (
      select 1 from public.decks d
      where d.id = deck_id and d.user_id = auth.uid()
    )
  )
  with check (
    exists (
      select 1 from public.decks d
      where d.id = deck_id and d.user_id = auth.uid()
    )
  );

drop policy if exists "Anyone read cards in public decks" on public.deck_cards;
create policy "Anyone read cards in public decks"
  on public.deck_cards for select to anon, authenticated
  using (
    exists (
      select 1 from public.decks d
      where d.id = deck_id and d.is_public = true
    )
  );

grant select, insert, update, delete on table public.deck_cards to authenticated;
grant select on table public.deck_cards to anon;

-- ---------------------------------------------------------------------------
-- deck_tags (deck-specific tags)
-- ---------------------------------------------------------------------------
create table if not exists public.deck_tags (
  id uuid primary key default gen_random_uuid(),
  deck_id uuid not null references public.decks (id) on delete cascade,
  name text not null,
  color text not null default '#888888',
  created_at timestamptz not null default timezone('utc'::text, now()),
  constraint deck_tags_unique_name unique (deck_id, name)
);

create index if not exists deck_tags_deck_id_idx on public.deck_tags (deck_id);

alter table public.deck_tags enable row level security;

drop policy if exists "Users manage tags in own decks" on public.deck_tags;
create policy "Users manage tags in own decks"
  on public.deck_tags for all to authenticated
  using (
    exists (
      select 1 from public.decks d
      where d.id = deck_id and d.user_id = auth.uid()
    )
  )
  with check (
    exists (
      select 1 from public.decks d
      where d.id = deck_id and d.user_id = auth.uid()
    )
  );

drop policy if exists "Anyone read tags on public decks" on public.deck_tags;
create policy "Anyone read tags on public decks"
  on public.deck_tags for select to anon, authenticated
  using (
    exists (
      select 1 from public.decks d
      where d.id = deck_id and d.is_public = true
    )
  );

grant select, insert, update, delete on table public.deck_tags to authenticated;
grant select on table public.deck_tags to anon;

-- ---------------------------------------------------------------------------
-- deck_card_tags
-- ---------------------------------------------------------------------------
create table if not exists public.deck_card_tags (
  deck_card_id uuid not null references public.deck_cards (id) on delete cascade,
  tag_id uuid not null references public.deck_tags (id) on delete cascade,
  primary key (deck_card_id, tag_id)
);

create index if not exists deck_card_tags_tag_id_idx on public.deck_card_tags (tag_id);

alter table public.deck_card_tags enable row level security;

drop policy if exists "Users manage card tags in own decks" on public.deck_card_tags;
create policy "Users manage card tags in own decks"
  on public.deck_card_tags for all to authenticated
  using (
    exists (
      select 1
      from public.deck_cards dc
      join public.decks d on d.id = dc.deck_id
      where dc.id = deck_card_id and d.user_id = auth.uid()
    )
  )
  with check (
    exists (
      select 1
      from public.deck_cards dc
      join public.decks d on d.id = dc.deck_id
      where dc.id = deck_card_id and d.user_id = auth.uid()
    )
  );

drop policy if exists "Anyone read card tags on public decks" on public.deck_card_tags;
create policy "Anyone read card tags on public decks"
  on public.deck_card_tags for select to anon, authenticated
  using (
    exists (
      select 1
      from public.deck_cards dc
      join public.decks d on d.id = dc.deck_id
      where dc.id = deck_card_id and d.is_public = true
    )
  );

grant select, insert, update, delete on table public.deck_card_tags to authenticated;
grant select on table public.deck_card_tags to anon;
