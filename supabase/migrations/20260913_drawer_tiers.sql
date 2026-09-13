-- Tier ranking on drawer membership (1 = highest priority). Not unique.
ALTER TABLE public.drawer_cards
  ADD COLUMN IF NOT EXISTS tier int NOT NULL DEFAULT 1
    CHECK (tier >= 1);

COMMENT ON COLUMN public.drawer_cards.tier IS
  'User ranking within a drawer; 1 is highest. Used for Apply/filter (e.g. only tiers 1–3).';
