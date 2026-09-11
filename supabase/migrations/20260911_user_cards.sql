-- DeckApp: per-user local card cache
-- Populated when a card is added to a deck or when the user sets art preferences.
-- Search remains Scryfall-first; this table stores denormalized display data.

create table if not exists public.user_cards (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade default auth.uid(),
  oracle_id uuid not null,
  -- Printing used for default display (preferred printing when set, else last seen)
  scryfall_id uuid not null,
  name text not null,
  type_line text not null default '',
  mana_cost text,
  cmc numeric,
  set_code text,
  set_name text,
  rarity text,
  collector_number text,
  layout text not null default 'normal',
  -- Fast path for hover / list art (custom storage URL or Scryfall normal)
  image_url text,
  preferred_scryfall_id uuid,
  has_custom_art boolean not null default false,
  scryfall_updated_at timestamptz,
  created_at timestamptz not null default timezone('utc'::text, now()),
  updated_at timestamptz not null default timezone('utc'::text, now()),
  constraint user_cards_user_oracle unique (user_id, oracle_id)
);

create index if not exists user_cards_user_id_idx on public.user_cards (user_id);
create index if not exists user_cards_oracle_id_idx on public.user_cards (oracle_id);
create index if not exists user_cards_name_idx on public.user_cards (user_id, name);

drop trigger if exists user_cards_set_updated_at on public.user_cards;
create trigger user_cards_set_updated_at
  before update on public.user_cards
  for each row
  execute function public.set_updated_at();

alter table public.user_cards enable row level security;

drop policy if exists "Users read own user cards" on public.user_cards;
create policy "Users read own user cards"
  on public.user_cards for select to authenticated
  using (auth.uid() = user_id);

drop policy if exists "Users insert own user cards" on public.user_cards;
create policy "Users insert own user cards"
  on public.user_cards for insert to authenticated
  with check (auth.uid() = user_id);

drop policy if exists "Users update own user cards" on public.user_cards;
create policy "Users update own user cards"
  on public.user_cards for update to authenticated
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

drop policy if exists "Users delete own user cards" on public.user_cards;
create policy "Users delete own user cards"
  on public.user_cards for delete to authenticated
  using (auth.uid() = user_id);

grant select, insert, update, delete on table public.user_cards to authenticated;
