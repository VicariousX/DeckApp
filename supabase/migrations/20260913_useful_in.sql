-- "Useful in" filter tags on user_cards (additive; does not replace printed color_identity).
-- Vocabulary: colorless | mono | multi | wubrg | W | U | B | R | G
ALTER TABLE public.user_cards
  ADD COLUMN IF NOT EXISTS useful_in text[] NOT NULL DEFAULT '{}'::text[];

COMMENT ON COLUMN public.user_cards.useful_in IS
  'Optional deck-fit tags for drawer filtering: colorless, mono, multi, wubrg, and/or WUBRG letters. Does not replace printed color_identity.';
