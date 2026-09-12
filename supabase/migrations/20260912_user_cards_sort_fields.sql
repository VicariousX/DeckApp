-- Cache color identity + oracle text on user_cards for local sort/group (drawers, etc.)
alter table public.user_cards
  add column if not exists color_identity text[] not null default '{}'::text[];

alter table public.user_cards
  add column if not exists oracle_text text;
