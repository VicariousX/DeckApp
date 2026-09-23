import { supabase } from "../lib/supabaseClient";
import type { Clause } from "../lib/search/syntaxModel";

export type SavedToken = {
  id: string;
  label: string;
  clause: Clause;
  savedAt: number;
};

export async function loadSearchTokens(
  userId: string | null
): Promise<SavedToken[]> {
  if (!userId) return [];
  const { data, error } = await supabase
    .from("user_prefs")
    .select("search_tokens")
    .eq("user_id", userId)
    .maybeSingle();
  if (error || !data) return [];
  const raw = data.search_tokens;
  return Array.isArray(raw) ? (raw as SavedToken[]) : [];
}

export async function saveSearchTokens(
  userId: string | null,
  tokens: SavedToken[]
): Promise<{ error: string | null }> {
  if (!userId) return { error: null };
  const { error } = await supabase.from("user_prefs").upsert(
    {
      user_id: userId,
      search_tokens: tokens,
      updated_at: new Date().toISOString(),
    },
    { onConflict: "user_id" }
  );
  return { error: error?.message ?? null };
}

export type SavedSearch = {
  id: string;
  name: string;
  query: string;
  savedAt: number;
};

export async function loadSearchCatalog(
  userId: string | null
): Promise<SavedSearch[]> {
  if (!userId) return [];
  const { data, error } = await supabase
    .from("user_prefs")
    .select("search_catalog")
    .eq("user_id", userId)
    .maybeSingle();
  if (error || !data) return [];
  const raw = (data as { search_catalog?: SavedSearch[] }).search_catalog;
  return Array.isArray(raw) ? raw : [];
}

export async function saveSearchCatalog(
  userId: string | null,
  catalog: SavedSearch[]
): Promise<{ error: string | null }> {
  if (!userId) return { error: null };
  const { error } = await supabase.from("user_prefs").upsert(
    {
      user_id: userId,
      search_catalog: catalog,
      updated_at: new Date().toISOString(),
    },
    { onConflict: "user_id" }
  );
  return { error: error?.message ?? null };
}
