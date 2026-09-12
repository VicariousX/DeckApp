import { supabase } from "../lib/supabaseClient";
import { ensureUserCardFromScryfall, type UserCard } from "./userCardService";
import type { ScryfallCard } from "../types/scryfallCard";
import type { Drawer, DrawerCard, DrawerCardView } from "../types/drawer";
import { DEFAULT_DRAWER_NAMES } from "../types/drawer";

function normOracle(id: string): string {
  return id.toLowerCase();
}

export async function listDrawers(
  userId: string
): Promise<{ drawers: Drawer[]; error: string | null }> {
  const { data, error } = await supabase
    .from("drawers")
    .select("*")
    .eq("user_id", userId)
    .order("sort_order", { ascending: true })
    .order("name", { ascending: true });

  if (error) return { drawers: [], error: error.message };
  const drawers = (data ?? []) as Drawer[];

  // Card counts (lightweight second query)
  if (drawers.length === 0) return { drawers, error: null };
  const ids = drawers.map((d) => d.id);
  const { data: rows, error: cErr } = await supabase
    .from("drawer_cards")
    .select("drawer_id")
    .in("drawer_id", ids);
  if (cErr) return { drawers, error: null }; // counts optional
  const counts = new Map<string, number>();
  for (const r of rows ?? []) {
    const id = (r as { drawer_id: string }).drawer_id;
    counts.set(id, (counts.get(id) ?? 0) + 1);
  }
  return {
    drawers: drawers.map((d) => ({ ...d, card_count: counts.get(d.id) ?? 0 })),
    error: null,
  };
}

/** Create Land / Ramp / Draw if the user has no drawers yet. */
export async function seedDefaultDrawers(
  userId: string
): Promise<{ drawers: Drawer[]; error: string | null }> {
  const existing = await listDrawers(userId);
  if (existing.error) return existing;
  if (existing.drawers.length > 0) return existing;

  const rows = DEFAULT_DRAWER_NAMES.map((name, i) => ({
    user_id: userId,
    name,
    sort_order: i,
  }));
  const { error } = await supabase.from("drawers").insert(rows);
  if (error) return { drawers: [], error: error.message };
  return listDrawers(userId);
}

export async function createDrawer(
  userId: string,
  name: string
): Promise<{ drawer: Drawer | null; error: string | null }> {
  const trimmed = name.trim();
  if (!trimmed) return { drawer: null, error: "Name is required." };

  const { data: maxRow } = await supabase
    .from("drawers")
    .select("sort_order")
    .eq("user_id", userId)
    .order("sort_order", { ascending: false })
    .limit(1)
    .maybeSingle();
  const nextSort = ((maxRow as { sort_order?: number } | null)?.sort_order ?? -1) + 1;

  const { data, error } = await supabase
    .from("drawers")
    .insert({ user_id: userId, name: trimmed, sort_order: nextSort })
    .select("*")
    .maybeSingle();
  if (error) return { drawer: null, error: error.message };
  return { drawer: data as Drawer, error: null };
}

export async function renameDrawer(
  drawerId: string,
  name: string
): Promise<{ error: string | null }> {
  const trimmed = name.trim();
  if (!trimmed) return { error: "Name is required." };
  const { error } = await supabase
    .from("drawers")
    .update({ name: trimmed })
    .eq("id", drawerId);
  return { error: error?.message ?? null };
}

export async function deleteDrawer(
  drawerId: string
): Promise<{ error: string | null }> {
  const { error } = await supabase.from("drawers").delete().eq("id", drawerId);
  return { error: error?.message ?? null };
}

export async function fetchDrawerCards(
  drawerId: string,
  userId: string
): Promise<{ cards: DrawerCardView[]; error: string | null }> {
  const { data: membership, error } = await supabase
    .from("drawer_cards")
    .select("*")
    .eq("drawer_id", drawerId)
    .order("sort_order", { ascending: true });
  if (error) return { cards: [], error: error.message };
  const rows = (membership ?? []) as DrawerCard[];
  if (rows.length === 0) return { cards: [], error: null };

  const oracleIds = rows.map((r) => normOracle(r.oracle_id));
  const { data: userCards } = await supabase
    .from("user_cards")
    .select("*")
    .eq("user_id", userId)
    .in("oracle_id", oracleIds);

  const byOracle = new Map<string, UserCard>();
  for (const uc of (userCards ?? []) as UserCard[]) {
    byOracle.set(normOracle(uc.oracle_id), uc);
  }

  const views: DrawerCardView[] = rows.map((r) => {
    const uc = byOracle.get(normOracle(r.oracle_id));
    return {
      ...r,
      oracle_id: normOracle(r.oracle_id),
      name: uc?.name ?? "Unknown card",
      type_line: uc?.type_line ?? "",
      mana_cost: uc?.mana_cost ?? null,
      image_url: uc?.image_url ?? null,
      scryfall_id: uc?.scryfall_id ?? uc?.preferred_scryfall_id ?? null,
    };
  });
  return { cards: views, error: null };
}

/** Which drawers contain this oracle_id (for picker checks). */
export async function drawersContainingOracle(
  userId: string,
  oracleId: string
): Promise<{ drawerIds: string[]; error: string | null }> {
  const { data: drawers, error: dErr } = await supabase
    .from("drawers")
    .select("id")
    .eq("user_id", userId);
  if (dErr) return { drawerIds: [], error: dErr.message };
  const ids = (drawers ?? []).map((d) => (d as { id: string }).id);
  if (ids.length === 0) return { drawerIds: [], error: null };

  const { data, error } = await supabase
    .from("drawer_cards")
    .select("drawer_id")
    .eq("oracle_id", normOracle(oracleId))
    .in("drawer_id", ids);
  if (error) return { drawerIds: [], error: error.message };
  return {
    drawerIds: (data ?? []).map((r) => (r as { drawer_id: string }).drawer_id),
    error: null,
  };
}

export async function addOracleToDrawer(
  drawerId: string,
  oracleId: string
): Promise<{ error: string | null }> {
  const { data: maxRow } = await supabase
    .from("drawer_cards")
    .select("sort_order")
    .eq("drawer_id", drawerId)
    .order("sort_order", { ascending: false })
    .limit(1)
    .maybeSingle();
  const nextSort = ((maxRow as { sort_order?: number } | null)?.sort_order ?? -1) + 1;

  const { error } = await supabase.from("drawer_cards").upsert(
    {
      drawer_id: drawerId,
      oracle_id: normOracle(oracleId),
      sort_order: nextSort,
    },
    { onConflict: "drawer_id,oracle_id", ignoreDuplicates: true }
  );
  return { error: error?.message ?? null };
}

export async function removeOracleFromDrawer(
  drawerId: string,
  oracleId: string
): Promise<{ error: string | null }> {
  const { error } = await supabase
    .from("drawer_cards")
    .delete()
    .eq("drawer_id", drawerId)
    .eq("oracle_id", normOracle(oracleId));
  return { error: error?.message ?? null };
}

/**
 * Ensure user_cards exists for this Scryfall card, then toggle drawer membership.
 */
export async function toggleDrawerMembershipFromScryfall(
  userId: string,
  drawerId: string,
  scryfallCard: ScryfallCard,
  currentlyIn: boolean
): Promise<{ error: string | null }> {
  const { card, error: uErr } = await ensureUserCardFromScryfall(
    userId,
    scryfallCard
  );
  if (uErr || !card) return { error: uErr ?? "Could not save card." };
  if (currentlyIn) {
    return removeOracleFromDrawer(drawerId, card.oracle_id);
  }
  return addOracleToDrawer(drawerId, card.oracle_id);
}

export async function toggleDrawerMembershipByOracle(
  drawerId: string,
  oracleId: string,
  currentlyIn: boolean
): Promise<{ error: string | null }> {
  if (currentlyIn) return removeOracleFromDrawer(drawerId, oracleId);
  return addOracleToDrawer(drawerId, oracleId);
}
