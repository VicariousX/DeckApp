import { supabase } from "../lib/supabaseClient";
import type {
  AddDeckCardInput,
  CreateDeckInput,
  Deck,
  DeckCard,
  DeckDetail,
  DeckTag,
} from "../types/deck";

export async function listMyDecks(
  userId: string
): Promise<{ decks: Deck[]; error: string | null }> {
  const { data, error } = await supabase
    .from("decks")
    .select("*")
    .eq("user_id", userId)
    .order("updated_at", { ascending: false });

  if (error) return { decks: [], error: error.message };
  return { decks: (data ?? []) as Deck[], error: null };
}

export async function createDeck(
  userId: string,
  input: CreateDeckInput
): Promise<{ deck: Deck | null; error: string | null }> {
  const name = input.name.trim();
  if (!name) return { deck: null, error: "Deck name is required." };

  const { data, error } = await supabase
    .from("decks")
    .insert({
      user_id: userId,
      name,
      description: input.description?.trim() ?? "",
      format: input.format?.trim() || "casual",
      is_public: input.is_public ?? false,
    })
    .select("*")
    .single();

  if (error) return { deck: null, error: error.message };
  return { deck: data as Deck, error: null };
}

export async function deleteDeck(
  deckId: string
): Promise<{ error: string | null }> {
  const { error } = await supabase.from("decks").delete().eq("id", deckId);
  return { error: error?.message ?? null };
}

export async function updateDeck(
  deckId: string,
  patch: Partial<Pick<Deck, "name" | "description" | "format" | "is_public">>
): Promise<{ deck: Deck | null; error: string | null }> {
  const { data, error } = await supabase
    .from("decks")
    .update(patch)
    .eq("id", deckId)
    .select("*")
    .single();
  if (error) return { deck: null, error: error.message };
  return { deck: data as Deck, error: null };
}

export async function fetchDeckDetail(
  deckId: string
): Promise<{ detail: DeckDetail | null; error: string | null }> {
  const { data: deck, error: deckErr } = await supabase
    .from("decks")
    .select("*")
    .eq("id", deckId)
    .maybeSingle();

  if (deckErr) return { detail: null, error: deckErr.message };
  if (!deck) return { detail: null, error: "Deck not found." };

  const { data: cards, error: cardsErr } = await supabase
    .from("deck_cards")
    .select("*")
    .eq("deck_id", deckId)
    .order("name", { ascending: true });

  if (cardsErr) return { detail: null, error: cardsErr.message };

  const { data: tags, error: tagsErr } = await supabase
    .from("deck_tags")
    .select("*")
    .eq("deck_id", deckId)
    .order("name", { ascending: true });

  if (tagsErr) return { detail: null, error: tagsErr.message };

  const cardIds = (cards ?? []).map((c) => c.id as string);
  let tagLinks: { deck_card_id: string; tag_id: string }[] = [];
  if (cardIds.length > 0) {
    const { data: links, error: linkErr } = await supabase
      .from("deck_card_tags")
      .select("deck_card_id, tag_id")
      .in("deck_card_id", cardIds);
    if (linkErr) return { detail: null, error: linkErr.message };
    tagLinks = (links ?? []) as { deck_card_id: string; tag_id: string }[];
  }

  const tagsByCard = new Map<string, string[]>();
  for (const link of tagLinks) {
    const list = tagsByCard.get(link.deck_card_id) ?? [];
    list.push(link.tag_id);
    tagsByCard.set(link.deck_card_id, list);
  }

  const enriched: DeckCard[] = ((cards ?? []) as DeckCard[]).map((c) => ({
    ...c,
    tag_ids: tagsByCard.get(c.id) ?? [],
  }));

  return {
    detail: {
      deck: deck as Deck,
      cards: enriched,
      tags: (tags ?? []) as DeckTag[],
    },
    error: null,
  };
}

export async function addCardToDeck(
  deckId: string,
  input: AddDeckCardInput
): Promise<{ card: DeckCard | null; error: string | null }> {
  const board = input.board ?? "main";
  const quantity = input.quantity ?? 1;

  // Upsert quantity if same printing already on same board
  const { data: existing } = await supabase
    .from("deck_cards")
    .select("*")
    .eq("deck_id", deckId)
    .eq("scryfall_id", input.scryfall_id)
    .eq("board", board)
    .maybeSingle();

  if (existing) {
    const { data, error } = await supabase
      .from("deck_cards")
      .update({ quantity: (existing.quantity as number) + quantity })
      .eq("id", existing.id)
      .select("*")
      .single();
    if (error) return { card: null, error: error.message };
    return { card: { ...(data as DeckCard), tag_ids: [] }, error: null };
  }

  const { data, error } = await supabase
    .from("deck_cards")
    .insert({
      deck_id: deckId,
      oracle_id: input.oracle_id,
      scryfall_id: input.scryfall_id,
      name: input.name,
      type_line: input.type_line ?? "",
      mana_cost: input.mana_cost ?? null,
      cmc: input.cmc ?? null,
      quantity,
      board,
    })
    .select("*")
    .single();

  if (error) return { card: null, error: error.message };
  return { card: { ...(data as DeckCard), tag_ids: [] }, error: null };
}

export async function setCardQuantity(
  cardId: string,
  quantity: number
): Promise<{ error: string | null }> {
  if (quantity <= 0) {
    const { error } = await supabase
      .from("deck_cards")
      .delete()
      .eq("id", cardId);
    return { error: error?.message ?? null };
  }
  const { error } = await supabase
    .from("deck_cards")
    .update({ quantity })
    .eq("id", cardId);
  return { error: error?.message ?? null };
}

export async function removeCardFromDeck(
  cardId: string
): Promise<{ error: string | null }> {
  const { error } = await supabase.from("deck_cards").delete().eq("id", cardId);
  return { error: error?.message ?? null };
}

export async function createDeckTag(
  deckId: string,
  name: string,
  color = "#888888"
): Promise<{ tag: DeckTag | null; error: string | null }> {
  const n = name.trim();
  if (!n) return { tag: null, error: "Tag name required." };
  const { data, error } = await supabase
    .from("deck_tags")
    .insert({ deck_id: deckId, name: n, color })
    .select("*")
    .single();
  if (error) return { tag: null, error: error.message };
  return { tag: data as DeckTag, error: null };
}

export async function deleteDeckTag(
  tagId: string
): Promise<{ error: string | null }> {
  const { error } = await supabase.from("deck_tags").delete().eq("id", tagId);
  return { error: error?.message ?? null };
}

export async function setCardTag(
  deckCardId: string,
  tagId: string,
  enabled: boolean
): Promise<{ error: string | null }> {
  if (enabled) {
    const { error } = await supabase
      .from("deck_card_tags")
      .upsert({ deck_card_id: deckCardId, tag_id: tagId });
    return { error: error?.message ?? null };
  }
  const { error } = await supabase
    .from("deck_card_tags")
    .delete()
    .eq("deck_card_id", deckCardId)
    .eq("tag_id", tagId);
  return { error: error?.message ?? null };
}
