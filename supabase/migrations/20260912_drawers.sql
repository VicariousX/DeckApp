-- DeckApp: user-scoped Drawers (reusable card groups)
-- Membership is by oracle_id; display/art resolves via user_cards.

create table if not exists public.drawers (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade default auth.uid(),
  name text not null,
  sort_order integer not null default 0,
  created_at timestamptz not null default timezone('utc'::text, now()),
  updated_at timestamptz not null default timezone('utc'::text, now()),
  constraint drawers_name_not_empty check (char_length(trim(name)) > 0)
);

create index if not exists drawers_user_id_idx on public.drawers (user_id);
create index if not exists drawers_user_sort_idx on public.drawers (user_id, sort_order);

drop trigger if exists drawers_set_updated_at on public.drawers;
create trigger drawers_set_updated_at
  before update on public.drawers
  for each row
  execute function public.set_updated_at();

alter table public.drawers enable row level security;

drop policy if exists "Users read own drawers" on public.drawers;
create policy "Users read own drawers"
  on public.drawers for select to authenticated
  using (auth.uid() = user_id);

drop policy if exists "Users insert own drawers" on public.drawers;
create policy "Users insert own drawers"
  on public.drawers for insert to authenticated
  with check (auth.uid() = user_id);

drop policy if exists "Users update own drawers" on public.drawers;
create policy "Users update own drawers"
  on public.drawers for update to authenticated
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

drop policy if exists "Users delete own drawers" on public.drawers;
create policy "Users delete own drawers"
  on public.drawers for delete to authenticated
  using (auth.uid() = user_id);

grant select, insert, update, delete on table public.drawers to authenticated;

create table if not exists public.drawer_cards (
  id uuid primary key default gen_random_uuid(),
  drawer_id uuid not null references public.drawers (id) on delete cascade,
  oracle_id uuid not null,
  sort_order integer not null default 0,
  created_at timestamptz not null default timezone('utc'::text, now()),
  constraint drawer_cards_drawer_oracle unique (drawer_id, oracle_id)
);

create index if not exists drawer_cards_drawer_id_idx on public.drawer_cards (drawer_id);
create index if not exists drawer_cards_oracle_id_idx on public.drawer_cards (oracle_id);

alter table public.drawer_cards enable row level security;

-- Access via owning drawer
drop policy if exists "Users read own drawer cards" on public.drawer_cards;
create policy "Users read own drawer cards"
  on public.drawer_cards for select to authenticated
  using (
    exists (
      select 1 from public.drawers d
      where d.id = drawer_id and d.user_id = auth.uid()
    )
  );

drop policy if exists "Users insert own drawer cards" on public.drawer_cards;
create policy "Users insert own drawer cards"
  on public.drawer_cards for insert to authenticated
  with check (
    exists (
      select 1 from public.drawers d
      where d.id = drawer_id and d.user_id = auth.uid()
    )
  );

drop policy if exists "Users update own drawer cards" on public.drawer_cards;
create policy "Users update own drawer cards"
  on public.drawer_cards for update to authenticated
  using (
    exists (
      select 1 from public.drawers d
      where d.id = drawer_id and d.user_id = auth.uid()
    )
  )
  with check (
    exists (
      select 1 from public.drawers d
      where d.id = drawer_id and d.user_id = auth.uid()
    )
  );

drop policy if exists "Users delete own drawer cards" on public.drawer_cards;
create policy "Users delete own drawer cards"
  on public.drawer_cards for delete to authenticated
  using (
    exists (
      select 1 from public.drawers d
      where d.id = drawer_id and d.user_id = auth.uid()
    )
  );

grant select, insert, update, delete on table public.drawer_cards to authenticated;
