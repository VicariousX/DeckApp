-- Overlay templates for the proxy creator. Readable by anyone, writable by signed-in users.
create table if not exists public.overlay_templates (
  id text primary key,
  name text not null,
  elements jsonb not null default '[]'::jsonb,
  created_by uuid references auth.users(id) on delete set null,
  updated_at timestamptz not null default now()
);

alter table public.overlay_templates enable row level security;

drop policy if exists overlay_templates_read on public.overlay_templates;
create policy overlay_templates_read on public.overlay_templates
  for select using (true);

drop policy if exists overlay_templates_write on public.overlay_templates;
create policy overlay_templates_write on public.overlay_templates
  for all using (auth.uid() is not null) with check (auth.uid() is not null);

grant select on public.overlay_templates to anon, authenticated;
grant insert, update, delete on public.overlay_templates to authenticated;
