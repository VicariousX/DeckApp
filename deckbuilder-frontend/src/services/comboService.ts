import { supabase } from "../lib/supabaseClient";
import type { ComboLock } from "../lib/combos";

export async function loadRemoteCombos(
  userId: string | null
): Promise<ComboLock[] | null> {
  if (!userId) return null;
  const { data, error } = await supabase
    .from("user_prefs")
    .select("combos")
    .eq("user_id", userId)
    .maybeSingle();
  if (error || !data) return null;
  const raw = (data as { combos?: ComboLock[] }).combos;
  return Array.isArray(raw) ? raw : [];
}

export async function saveRemoteCombos(
  userId: string | null,
  combos: ComboLock[]
): Promise<{ error: string | null }> {
  if (!userId) return { error: null };
  const { error } = await supabase.from("user_prefs").upsert(
    {
      user_id: userId,
      combos,
      updated_at: new Date().toISOString(),
    },
    { onConflict: "user_id" }
  );
  return { error: error?.message ?? null };
}

export type SearchPin = { key: string; name: string; category?: string };

export async function loadRemotePins(
  userId: string | null
): Promise<SearchPin[] | null> {
  if (!userId) return null;
  const { data, error } = await supabase
    .from("user_prefs")
    .select("search_pins")
    .eq("user_id", userId)
    .maybeSingle();
  if (error || !data) return null;
  const raw = (data as { search_pins?: SearchPin[] }).search_pins;
  return Array.isArray(raw) ? raw : null;
}

export async function saveRemotePins(
  userId: string | null,
  pins: SearchPin[]
): Promise<{ error: string | null }> {
  if (!userId) return { error: null };
  const { error } = await supabase.from("user_prefs").upsert(
    {
      user_id: userId,
      search_pins: pins,
      updated_at: new Date().toISOString(),
    },
    { onConflict: "user_id" }
  );
  return { error: error?.message ?? null };
}
