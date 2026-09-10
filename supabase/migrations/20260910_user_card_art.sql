-- DeckApp: per-user preferred / custom card art
-- Run in Supabase SQL editor (or via CLI) after Auth is enabled.

-- ---------------------------------------------------------------------------
-- Table: user_card_art
-- One row per (user, oracle_id). oracle_id groups all printings of a card.
-- ---------------------------------------------------------------------------
create table if not exists public.user_card_art (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade,
  -- Scryfall oracle_id — stable across printings / languages
  oracle_id text not null,
  -- Optional: pin display to a specific Scryfall printing id
  preferred_scryfall_id text,
  -- Optional custom uploads (paths inside the card-art bucket)
  custom_front_path text,
  custom_back_path text,
  notes text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint user_card_art_user_oracle unique (user_id, oracle_id)
);

create index if not exists user_card_art_user_id_idx
  on public.user_card_art (user_id);

create index if not exists user_card_art_oracle_id_idx
  on public.user_card_art (oracle_id);

-- Keep updated_at fresh
create or replace function public.set_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

drop trigger if exists user_card_art_set_updated_at on public.user_card_art;
create trigger user_card_art_set_updated_at
  before update on public.user_card_art
  for each row
  execute function public.set_updated_at();

-- ---------------------------------------------------------------------------
-- RLS
-- ---------------------------------------------------------------------------
alter table public.user_card_art enable row level security;

drop policy if exists "Users read own card art" on public.user_card_art;
create policy "Users read own card art"
  on public.user_card_art
  for select
  to authenticated
  using (auth.uid() = user_id);

drop policy if exists "Users insert own card art" on public.user_card_art;
create policy "Users insert own card art"
  on public.user_card_art
  for insert
  to authenticated
  with check (auth.uid() = user_id);

drop policy if exists "Users update own card art" on public.user_card_art;
create policy "Users update own card art"
  on public.user_card_art
  for update
  to authenticated
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

drop policy if exists "Users delete own card art" on public.user_card_art;
create policy "Users delete own card art"
  on public.user_card_art
  for delete
  to authenticated
  using (auth.uid() = user_id);

-- ---------------------------------------------------------------------------
-- Storage bucket: card-art
-- Object path convention: {user_id}/{oracle_id}/front.<ext>
--                       {user_id}/{oracle_id}/back.<ext>
-- ---------------------------------------------------------------------------
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values (
  'card-art',
  'card-art',
  true, -- public read so <img> tags work without signed URLs
  5242880, -- 5 MB
  array['image/png', 'image/jpeg', 'image/webp', 'image/gif']
)
on conflict (id) do update set
  public = excluded.public,
  file_size_limit = excluded.file_size_limit,
  allowed_mime_types = excluded.allowed_mime_types;

-- Anyone can read (public bucket); only owner can write under their prefix
drop policy if exists "Public read card-art" on storage.objects;
create policy "Public read card-art"
  on storage.objects
  for select
  to public
  using (bucket_id = 'card-art');

drop policy if exists "Users upload own card-art" on storage.objects;
create policy "Users upload own card-art"
  on storage.objects
  for insert
  to authenticated
  with check (
    bucket_id = 'card-art'
    and (storage.foldername(name))[1] = auth.uid()::text
  );

drop policy if exists "Users update own card-art" on storage.objects;
create policy "Users update own card-art"
  on storage.objects
  for update
  to authenticated
  using (
    bucket_id = 'card-art'
    and (storage.foldername(name))[1] = auth.uid()::text
  )
  with check (
    bucket_id = 'card-art'
    and (storage.foldername(name))[1] = auth.uid()::text
  );

drop policy if exists "Users delete own card-art" on storage.objects;
create policy "Users delete own card-art"
  on storage.objects
  for delete
  to authenticated
  using (
    bucket_id = 'card-art'
    and (storage.foldername(name))[1] = auth.uid()::text
  );
