-- Community mechanic marks on cards (oracle_id).
alter table public.user_prefs
  add column if not exists is_admin boolean not null default false;

create table if not exists public.card_mechanic_marks (
  id uuid primary key default gen_random_uuid(),
  oracle_id text not null,
  mechanic_id text not null,
  economy text not null default 'both'
    check (economy in ('producer', 'payoff', 'both')),
  flow text not null default 'both'
    check (flow in ('feed', 'bleed', 'both')),
  agency text not null default 'both'
    check (agency in ('cause', 'benefit', 'both')),
  status text not null default 'proposed'
    check (status in ('proposed', 'accepted', 'flagged', 'locked', 'rejected')),
  proposed_by uuid references auth.users (id) on delete set null,
  locked_by uuid references auth.users (id) on delete set null,
  endorse_count int not null default 0,
  flag_count int not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create unique index if not exists card_mechanic_marks_unique
  on public.card_mechanic_marks (oracle_id, mechanic_id, economy, flow, agency, proposed_by);

create index if not exists card_mechanic_marks_oracle
  on public.card_mechanic_marks (oracle_id);

create index if not exists card_mechanic_marks_mechanic
  on public.card_mechanic_marks (mechanic_id, status);

create table if not exists public.card_mechanic_votes (
  mark_id uuid not null references public.card_mechanic_marks (id) on delete cascade,
  user_id uuid not null references auth.users (id) on delete cascade,
  kind text not null check (kind in ('endorse', 'flag')),
  created_at timestamptz not null default now(),
  primary key (mark_id, user_id)
);

alter table public.card_mechanic_marks enable row level security;
alter table public.card_mechanic_votes enable row level security;

drop policy if exists "marks readable" on public.card_mechanic_marks;
create policy "marks readable" on public.card_mechanic_marks
  for select to authenticated, anon using (true);

drop policy if exists "marks insert own" on public.card_mechanic_marks;
create policy "marks insert own" on public.card_mechanic_marks
  for insert to authenticated
  with check (proposed_by = auth.uid());

drop policy if exists "marks update own or admin" on public.card_mechanic_marks;
create policy "marks update own or admin" on public.card_mechanic_marks
  for update to authenticated
  using (
    proposed_by = auth.uid()
    or exists (
      select 1 from public.user_prefs p
      where p.user_id = auth.uid() and p.is_admin
    )
  );

drop policy if exists "votes readable" on public.card_mechanic_votes;
create policy "votes readable" on public.card_mechanic_votes
  for select to authenticated using (true);

drop policy if exists "votes write own" on public.card_mechanic_votes;
create policy "votes write own" on public.card_mechanic_votes
  for insert to authenticated
  with check (user_id = auth.uid());

drop policy if exists "votes update own" on public.card_mechanic_votes;
create policy "votes update own" on public.card_mechanic_votes
  for update to authenticated
  using (user_id = auth.uid());

grant select on table public.card_mechanic_marks to anon, authenticated;
grant insert, update on table public.card_mechanic_marks to authenticated;
grant select, insert, update on table public.card_mechanic_votes to authenticated;
