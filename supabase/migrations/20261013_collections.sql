-- DeckApp: user collections (physical inventory, liked cards, etc.)

create table if not exists public.collections (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade default auth.uid(),
  name text not null,
  ownership text not null default 'na',
  print_specific boolean not null default false,
  quantity_counters boolean not null default false,
  is_public boolean not null default false,
  is_default boolean not null default false,
  created_at timestamptz not null default timezone('utc'::text, now()),
  updated_at timestamptz not null default timezone('utc'::text, now()),
  constraint collections_name_not_empty check (char_length(trim(name)) > 0),
  constraint collections_ownership check (ownership in ('physical', 'digital', 'na'))
);

create index if not exists collections_user_id_idx on public.collections (user_id);
create unique index if not exists collections_one_default
  on public.collections (user_id)
  where is_default;

drop trigger if exists collections_set_updated_at on public.collections;
create trigger collections_set_updated_at
  before update on public.collections
  for each row
  execute function public.set_updated_at();

alter table public.collections enable row level security;

drop policy if exists "Users read own or public collections" on public.collections;
create policy "Users read own or public collections"
  on public.collections for select to authenticated
  using (auth.uid() = user_id or is_public);

drop policy if exists "Users insert own collections" on public.collections;
create policy "Users insert own collections"
  on public.collections for insert to authenticated
  with check (auth.uid() = user_id);

drop policy if exists "Users update own collections" on public.collections;
create policy "Users update own collections"
  on public.collections for update to authenticated
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

drop policy if exists "Users delete own collections" on public.collections;
create policy "Users delete own collections"
  on public.collections for delete to authenticated
  using (auth.uid() = user_id);

grant select, insert, update, delete on table public.collections to authenticated;
