-- Search targets: which groupings can be selected on the search/results page.
alter table public.user_prefs
  add column if not exists search_targets jsonb not null default '[]'::jsonb;
