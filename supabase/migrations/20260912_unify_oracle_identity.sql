-- Unify deck membership on oracle_id (DeckApp identity) per board.
-- Merge any duplicate printings of the same oracle on the same board,
-- then replace unique (deck_id, scryfall_id, board) with (deck_id, oracle_id, board).
-- Also add imposed_color_identity on user_cards for user overrides (e.g. Yavimaya → G).

-- 1) Merge duplicate oracle rows on the same deck+board (keep lowest sort_order, sum qty)
WITH ranked AS (
  SELECT
    id,
    deck_id,
    oracle_id,
    board,
    quantity,
    sort_order,
    scryfall_id,
    ROW_NUMBER() OVER (
      PARTITION BY deck_id, oracle_id, board
      ORDER BY sort_order ASC, created_at ASC
    ) AS rn,
    SUM(quantity) OVER (
      PARTITION BY deck_id, oracle_id, board
    ) AS total_qty
  FROM public.deck_cards
),
keepers AS (
  SELECT id, total_qty FROM ranked WHERE rn = 1
),
dupes AS (
  SELECT id FROM ranked WHERE rn > 1
)
UPDATE public.deck_cards dc
SET quantity = k.total_qty
FROM keepers k
WHERE dc.id = k.id;

DELETE FROM public.deck_cards dc
USING (
  SELECT id
  FROM (
    SELECT
      id,
      ROW_NUMBER() OVER (
        PARTITION BY deck_id, oracle_id, board
        ORDER BY sort_order ASC, created_at ASC
      ) AS rn
    FROM public.deck_cards
  ) x
  WHERE rn > 1
) d
WHERE dc.id = d.id;

-- Re-point deck_card_tags from deleted cards is N/A after delete (cascade if FK)
-- (tags on merged-away rows are dropped; acceptable one-time cleanup)

ALTER TABLE public.deck_cards
  DROP CONSTRAINT IF EXISTS deck_cards_unique_entry;

ALTER TABLE public.deck_cards
  ADD CONSTRAINT deck_cards_unique_oracle
  UNIQUE (deck_id, oracle_id, board);

-- 2) User-imposed color identity override for drawer / filter logic
ALTER TABLE public.user_cards
  ADD COLUMN IF NOT EXISTS imposed_color_identity text[] NULL;

COMMENT ON COLUMN public.user_cards.imposed_color_identity IS
  'Optional user override for color identity (e.g. treat Yavimaya as G). When set, used instead of printed color_identity for drawer filters.';
