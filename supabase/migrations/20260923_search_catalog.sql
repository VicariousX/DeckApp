alter table public.user_prefs
  add column if not exists search_catalog jsonb not null default '[]'::jsonb;
