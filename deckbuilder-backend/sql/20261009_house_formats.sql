-- House formats for play groups. Public rows are the later community layer.
create table if not exists public.house_formats (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  name text not null,
  rules jsonb not null default '{}'::jsonb,
  is_public boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table public.house_formats enable row level security;

create policy "owner all house formats" on public.house_formats
  for all using (auth.uid() = user_id) with check (auth.uid() = user_id);

create policy "public read house formats" on public.house_formats
  for select using (is_public = true);
