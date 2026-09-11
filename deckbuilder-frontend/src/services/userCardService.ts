import { supabase } from "../lib/supabaseClient";
import { cardArtPublicUrl } from "./cardArtService";
import type { UserCardArt } from "../types/deckAppCard";
import type { ScryfallCard } from "../types/scryfallCard";

/** Row shape for public.user_cards */
export type UserCard = {
  id: string;
  user_id: string;
  oracle_id: string;
  scryfall_id: string;
  name: string;
  type_line: string;
  mana_cost: string | null;
  cmc: number | null;
  set_code: string | null;
  set_name: string | null;
  rarity: string | null;
  collector_number: string | null;
  layout: string;
  image_url: string | null;
  preferred_scryfall_id: string | null;
  has_custom_art: boolean;
  scryfall_updated_at: string | null;
  created_at: string;
  updated_at: string;
};

function scryfallImage(card: ScryfallCard): string {
  return (
    card.image_uris?.normal ||
    card.card_faces?.[0]?.image_uris?.normal ||
    card.image_uris?.large ||
    ""
  );
}

function oracleIdOf(card: ScryfallCard): string {
  return (card.oracle_id ?? card.id).toLowerCase();
}

/**
 * Upsert a local user card from a Scryfall hit (e.g. when adding to a deck).
 * Does not overwrite preferred/custom art fields if the row already exists.
 */
export async function ensureUserCardFromScryfall(
  userId: string,
  card: ScryfallCard
): Promise<{ card: UserCard | null; error: string | null }> {
  const oracle_id = oracleIdOf(card);
  const image_url = scryfallImage(card) || null;

  const { data: existing } = await supabase
    .from("user_cards")
    .select("*")
    .eq("user_id", userId)
    .eq("oracle_id", oracle_id)
    .maybeSingle();

  if (existing) {
    // Refresh name/type if missing; leave art fields alone
    const patch: Record<string, unknown> = {
      name: card.name,
      type_line: card.type_line ?? "",
      mana_cost: card.mana_cost ?? null,
      cmc: card.cmc ?? null,
    };
    if (!(existing as UserCard).image_url && image_url) {
      patch.image_url = image_url;
    }
    if (!(existing as UserCard).scryfall_id) {
      patch.scryfall_id = card.id;
    }
    const { data, error } = await supabase
      .from("user_cards")
      .update(patch)
      .eq("id", (existing as UserCard).id)
      .select("*")
      .maybeSingle();
    if (error) return { card: null, error: error.message };
    return { card: (data as UserCard) ?? (existing as UserCard), error: null };
  }

  const { data, error } = await supabase
    .from("user_cards")
    .insert({
      user_id: userId,
      oracle_id,
      scryfall_id: card.id,
      name: card.name,
      type_line: card.type_line ?? "",
      mana_cost: card.mana_cost ?? null,
      cmc: card.cmc ?? null,
      set_code: card.set ?? null,
      set_name: card.set_name ?? null,
      rarity: card.rarity ?? null,
      collector_number: card.collector_number ?? null,
      layout: card.layout ?? "normal",
      image_url,
      preferred_scryfall_id: null,
      has_custom_art: false,
      scryfall_updated_at: new Date().toISOString(),
    })
    .select("*")
    .maybeSingle();

  if (error) return { card: null, error: error.message };
  return { card: (data as UserCard) ?? null, error: null };
}

/**
 * Sync user_cards display fields from an art preference + optional Scryfall printing.
 * Call after preferred printing / custom upload changes.
 */
export async function syncUserCardFromArt(
  userId: string,
  oracleId: string,
  art: UserCardArt | null,
  printing?: ScryfallCard | null
): Promise<{ card: UserCard | null; error: string | null }> {
  const oracle_id = oracleId.toLowerCase();

  let image_url: string | null = null;
  let has_custom_art = false;
  let preferred_scryfall_id: string | null =
    art?.preferred_scryfall_id ?? null;
  let scryfall_id: string | null = preferred_scryfall_id;

  if (art?.custom_front_path) {
    image_url = cardArtPublicUrl(art.custom_front_path) || null;
    has_custom_art = true;
  } else if (printing) {
    image_url = scryfallImage(printing) || null;
    scryfall_id = printing.id;
  }

  const base = {
    preferred_scryfall_id,
    has_custom_art,
    ...(image_url ? { image_url } : {}),
    ...(scryfall_id ? { scryfall_id } : {}),
    ...(printing
      ? {
          name: printing.name,
          type_line: printing.type_line ?? "",
          mana_cost: printing.mana_cost ?? null,
          cmc: printing.cmc ?? null,
          set_code: printing.set ?? null,
          set_name: printing.set_name ?? null,
          rarity: printing.rarity ?? null,
          collector_number: printing.collector_number ?? null,
          layout: printing.layout ?? "normal",
          scryfall_updated_at: new Date().toISOString(),
        }
      : {}),
  };

  const { data: existing } = await supabase
    .from("user_cards")
    .select("id")
    .eq("user_id", userId)
    .eq("oracle_id", oracle_id)
    .maybeSingle();

  if (existing) {
    const { data, error } = await supabase
      .from("user_cards")
      .update(base)
      .eq("id", existing.id)
      .select("*")
      .maybeSingle();
    if (error) return { card: null, error: error.message };
    return { card: (data as UserCard) ?? null, error: null };
  }

  // Need at least a name/scryfall id to insert
  if (!printing && !scryfall_id) {
    return { card: null, error: null };
  }

  const { data, error } = await supabase
    .from("user_cards")
    .insert({
      user_id: userId,
      oracle_id,
      scryfall_id: scryfall_id ?? printing!.id,
      name: printing?.name ?? "Unknown",
      type_line: printing?.type_line ?? "",
      mana_cost: printing?.mana_cost ?? null,
      cmc: printing?.cmc ?? null,
      set_code: printing?.set ?? null,
      set_name: printing?.set_name ?? null,
      rarity: printing?.rarity ?? null,
      collector_number: printing?.collector_number ?? null,
      layout: printing?.layout ?? "normal",
      image_url,
      preferred_scryfall_id,
      has_custom_art,
      scryfall_updated_at: new Date().toISOString(),
    })
    .select("*")
    .maybeSingle();

  if (error) return { card: null, error: error.message };
  return { card: (data as UserCard) ?? null, error: null };
}

/** Load all local cards for a user, keyed by oracle_id (lowercase). */
export async function fetchUserCardsMap(
  userId: string
): Promise<{ map: Map<string, UserCard>; error: string | null }> {
  const { data, error } = await supabase
    .from("user_cards")
    .select("*")
    .eq("user_id", userId);

  if (error) return { map: new Map(), error: error.message };

  const map = new Map<string, UserCard>();
  for (const row of (data ?? []) as UserCard[]) {
    map.set(String(row.oracle_id).toLowerCase(), {
      ...row,
      oracle_id: String(row.oracle_id).toLowerCase(),
    });
  }
  return { map, error: null };
}
