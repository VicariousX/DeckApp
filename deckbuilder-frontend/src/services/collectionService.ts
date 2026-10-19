import { supabase } from "../lib/supabaseClient";
import type { Collection, CollectionInput } from "../types/collection";

export async function listMyCollections(
  userId: string
): Promise<{ collections: Collection[]; error: string | null }> {
  const { data, error } = await supabase
    .from("collections")
    .select("*")
    .eq("user_id", userId)
    .order("created_at", { ascending: true });
  if (error) return { collections: [], error: error.message };
  return { collections: (data ?? []) as Collection[], error: null };
}

async function clearOtherDefaults(userId: string, keepId?: string) {
  let query = supabase
    .from("collections")
    .update({ is_default: false })
    .eq("user_id", userId)
    .eq("is_default", true);
  if (keepId) query = query.neq("id", keepId);
  await query;
}

export async function createCollection(
  userId: string,
  input: CollectionInput
): Promise<{ collection: Collection | null; error: string | null }> {
  const name = input.name.trim();
  if (!name) return { collection: null, error: "Collection name is required." };
  if (input.is_default) await clearOtherDefaults(userId);
  const { data, error } = await supabase
    .from("collections")
    .insert({
      user_id: userId,
      name,
      ownership: input.ownership,
      print_specific: input.print_specific,
      quantity_counters: input.quantity_counters,
      is_public: input.is_public,
      is_default: input.is_default,
    })
    .select("*")
    .single();
  if (error) return { collection: null, error: error.message };
  return { collection: data as Collection, error: null };
}

export async function updateCollection(
  userId: string,
  id: string,
  input: CollectionInput
): Promise<{ collection: Collection | null; error: string | null }> {
  const name = input.name.trim();
  if (!name) return { collection: null, error: "Collection name is required." };
  if (input.is_default) await clearOtherDefaults(userId, id);
  const { data, error } = await supabase
    .from("collections")
    .update({
      name,
      ownership: input.ownership,
      print_specific: input.print_specific,
      quantity_counters: input.quantity_counters,
      is_public: input.is_public,
      is_default: input.is_default,
    })
    .eq("id", id)
    .eq("user_id", userId)
    .select("*")
    .single();
  if (error) return { collection: null, error: error.message };
  return { collection: data as Collection, error: null };
}

export async function deleteCollection(
  userId: string,
  id: string
): Promise<{ error: string | null }> {
  const { error } = await supabase
    .from("collections")
    .delete()
    .eq("id", id)
    .eq("user_id", userId);
  return { error: error?.message ?? null };
}

const STARTERS: CollectionInput[] = [
  {
    name: "Liked Cards",
    ownership: "na",
    print_specific: false,
    quantity_counters: false,
    is_public: false,
    is_default: true,
  },
  {
    name: "My Physical Collection",
    ownership: "physical",
    print_specific: true,
    quantity_counters: true,
    is_public: false,
    is_default: false,
  },
];

export async function ensureStarterCollections(userId: string): Promise<Collection[]> {
  const { collections } = await listMyCollections(userId);
  if (collections.length) return collections;
  for (const starter of STARTERS) {
    await createCollection(userId, starter);
  }
  const next = await listMyCollections(userId);
  return next.collections;
}

export type CollectionCard = {
  id: string;
  collection_id: string;
  oracle_id: string;
  scryfall_id: string | null;
  identity: string;
  name: string;
  image_url: string | null;
  quantity: number;
};

function identityFor(collection: Collection, card: { oracle_id?: string | null; id: string }) {
  const oracle = card.oracle_id || card.id;
  return collection.print_specific ? card.id : oracle;
}

export async function getDefaultCollection(userId: string): Promise<Collection | null> {
  const { collections } = await listMyCollections(userId);
  return collections.find((c) => c.is_default) ?? collections[0] ?? null;
}

export async function listCollectionCards(collectionId: string): Promise<CollectionCard[]> {
  const { data } = await supabase
    .from("collection_cards")
    .select("*")
    .eq("collection_id", collectionId)
    .order("name");
  return (data ?? []) as CollectionCard[];
}

export async function addCardToCollection(
  collection: Collection,
  card: { id: string; oracle_id?: string | null; name: string; image_uris?: { normal?: string | null } | null; card_faces?: { image_uris?: { normal?: string | null } | null }[] | null }
): Promise<{ quantity: number; error: string | null }> {
  const identity = identityFor(collection, card);
  const image = card.image_uris?.normal || card.card_faces?.[0]?.image_uris?.normal || null;
  const existing = await supabase
    .from("collection_cards")
    .select("*")
    .eq("collection_id", collection.id)
    .eq("identity", identity)
    .maybeSingle();
  if (existing.data) {
    if (!collection.quantity_counters) return { quantity: 1, error: null };
    const next = (existing.data.quantity ?? 1) + 1;
    const { error } = await supabase
      .from("collection_cards")
      .update({ quantity: next })
      .eq("id", existing.data.id);
    return { quantity: next, error: error?.message ?? null };
  }
  const { error } = await supabase.from("collection_cards").insert({
    collection_id: collection.id,
    oracle_id: card.oracle_id || card.id,
    scryfall_id: card.id,
    identity,
    name: card.name,
    image_url: image,
    quantity: 1,
  });
  return { quantity: 1, error: error?.message ?? null };
}

export async function removeCardFromCollection(
  collection: Collection,
  card: { id: string; oracle_id?: string | null }
): Promise<{ quantity: number; error: string | null }> {
  const identity = identityFor(collection, card);
  const existing = await supabase
    .from("collection_cards")
    .select("*")
    .eq("collection_id", collection.id)
    .eq("identity", identity)
    .maybeSingle();
  if (!existing.data) return { quantity: 0, error: null };
  const qty = existing.data.quantity ?? 1;
  if (collection.quantity_counters && qty > 1) {
    const next = qty - 1;
    const { error } = await supabase
      .from("collection_cards")
      .update({ quantity: next })
      .eq("id", existing.data.id);
    return { quantity: next, error: error?.message ?? null };
  }
  const { error } = await supabase.from("collection_cards").delete().eq("id", existing.data.id);
  return { quantity: 0, error: error?.message ?? null };
}

export type CollectionPresence = {
  collection: Collection;
  quantity: number;
  identity: string;
};

/** Collections owned by the user that contain this card (oracle or printing). */
export async function listCollectionsContainingCard(
  userId: string,
  card: { id: string; oracle_id?: string | null }
): Promise<{ rows: CollectionPresence[]; error: string | null }> {
  const { collections, error: listErr } = await listMyCollections(userId);
  if (listErr) return { rows: [], error: listErr };
  if (!collections.length) return { rows: [], error: null };
  const oracle = (card.oracle_id || card.id).toLowerCase();
  const printing = card.id.toLowerCase();
  const { data, error } = await supabase
    .from("collection_cards")
    .select("collection_id, identity, quantity")
    .in(
      "collection_id",
      collections.map((c) => c.id)
    )
    .or(`identity.eq.${oracle},identity.eq.${printing}`);
  if (error) return { rows: [], error: error.message };
  const byId = new Map(collections.map((c) => [c.id, c]));
  const rows: CollectionPresence[] = [];
  for (const row of data ?? []) {
    const collection = byId.get((row as { collection_id: string }).collection_id);
    if (!collection) continue;
    rows.push({
      collection,
      quantity: (row as { quantity: number }).quantity ?? 1,
      identity: (row as { identity: string }).identity,
    });
  }
  return { rows, error: null };
}
