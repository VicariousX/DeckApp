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
    is_default: false,
  },
  {
    name: "My Physical Collection",
    ownership: "physical",
    print_specific: true,
    quantity_counters: true,
    is_public: false,
    is_default: true,
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
