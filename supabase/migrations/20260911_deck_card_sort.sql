-- DeckApp: sort order for deck cards (drag-and-drop in builder)
-- Safe to re-run

alter table public.deck_cards
  add column if not exists sort_order int not null default 0;

create index if not exists deck_cards_deck_board_sort_idx
  on public.deck_cards (deck_id, board, sort_order);

-- Backfill: stable order by name within each deck+board
with ranked as (
  select
    id,
    row_number() over (
      partition by deck_id, board
      order by name asc, created_at asc
    ) - 1 as rn
  from public.deck_cards
)
update public.deck_cards dc
set sort_order = ranked.rn
from ranked
where dc.id = ranked.id
  and dc.sort_order = 0;
