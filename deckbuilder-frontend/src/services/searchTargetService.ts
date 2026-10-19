import { supabase } from "../lib/supabaseClient";

export type TargetKind = "collection" | "deck" | "drawer";

export type SearchTargetRef = {
  kind: TargetKind;
  id: string;
  name: string;
};

export async function loadSearchTargets(userId: string): Promise<SearchTargetRef[]> {
  const { data, error } = await supabase
    .from("user_prefs")
    .select("search_targets")
    .eq("user_id", userId)
    .maybeSingle();
  if (error || !data) return [];
  const raw = (data as { search_targets?: SearchTargetRef[] }).search_targets;
  return Array.isArray(raw) ? raw : [];
}

export async function saveSearchTargets(
  userId: string,
  targets: SearchTargetRef[]
): Promise<{ error: string | null }> {
  const { error } = await supabase.from("user_prefs").upsert(
    {
      user_id: userId,
      search_targets: targets,
      updated_at: new Date().toISOString(),
    },
    { onConflict: "user_id" }
  );
  return { error: error?.message ?? null };
}

export async function setTargetable(
  userId: string,
  ref: SearchTargetRef,
  on: boolean
): Promise<{ error: string | null }> {
  const current = await loadSearchTargets(userId);
  const next = on
    ? [...current.filter((t) => !(t.kind === ref.kind && t.id === ref.id)), ref]
    : current.filter((t) => !(t.kind === ref.kind && t.id === ref.id));
  return saveSearchTargets(userId, next);
}
