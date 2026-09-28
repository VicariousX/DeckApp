alter table public.user_prefs
  add column if not exists combos jsonb not null default '[]'::jsonb;

alter table public.user_prefs
  add column if not exists search_pins jsonb not null default '[]'::jsonb;
