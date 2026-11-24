import { supabase } from "../lib/supabaseClient";
import type { Agency } from "../lib/mechanics/catalog";

export type MarkStatus =
  | "proposed"
  | "accepted"
  | "flagged"
  | "locked"
  | "rejected";

export type MechanicMark = {
  id: string;
  oracle_id: string;
  mechanic_id: string;
  relation: Agency;
  status: MarkStatus;
  proposed_by: string | null;
  endorse_count: number;
  flag_count: number;
};

const VISIBLE: MarkStatus[] = ["proposed", "accepted", "locked", "flagged"];

export async function isCurrentUserAdmin(userId: string): Promise<boolean> {
  const { data } = await supabase
    .from("user_prefs")
    .select("is_admin")
    .eq("user_id", userId)
    .maybeSingle();
  return Boolean((data as { is_admin?: boolean } | null)?.is_admin);
}

export async function listMarksForOracle(
  oracleId: string
): Promise<{ marks: MechanicMark[]; error: string | null }> {
  return listMarksForOracles([oracleId]);
}

export async function listMarksForOracles(
  oracleIds: string[]
): Promise<{ marks: MechanicMark[]; error: string | null }> {
  if (!oracleIds.length) return { marks: [], error: null };
  const { data, error } = await supabase
    .from("card_mechanic_marks")
    .select(
      "id, oracle_id, mechanic_id, relation, status, proposed_by, endorse_count, flag_count"
    )
    .in("oracle_id", oracleIds)
    .in("status", VISIBLE)
    .order("updated_at", { ascending: false });
  if (error) return { marks: [], error: error.message };
  return { marks: (data ?? []) as MechanicMark[], error: null };
}

export async function oracleIdsForMechanic(
  mechanicId: string,
  relation?: Agency
): Promise<{ ids: string[]; error: string | null }> {
  const ids: string[] = [];
  for (let from = 0; ; from += 1000) {
    let q = supabase
      .from("card_mechanic_marks")
      .select("oracle_id")
      .eq("mechanic_id", mechanicId)
      .in("status", VISIBLE);
    if (relation === "both") q = q.eq("relation", "both");
    else if (relation) q = q.in("relation", [relation, "both"]);
    const { data, error } = await q.range(from, from + 999);
    if (error) return { ids: [], error: error.message };
    for (const row of data ?? []) ids.push(String((row as { oracle_id: string }).oracle_id).toLowerCase());
    if (!data || data.length < 1000) break;
  }
  return { ids: [...new Set(ids)], error: null };
}

export async function proposeMark(
  userId: string,
  input: {
    oracle_id: string;
    mechanic_id: string;
    relation: Agency;
  }
): Promise<{ mark: MechanicMark | null; error: string | null }> {
  const { data, error } = await supabase
    .from("card_mechanic_marks")
    .insert({
      ...input,
      proposed_by: userId,
      status: "proposed",
    })
    .select(
      "id, oracle_id, mechanic_id, relation, status, proposed_by, endorse_count, flag_count"
    )
    .maybeSingle();
  if (error) return { mark: null, error: error.message };
  return { mark: data as MechanicMark, error: null };
}

export async function updateMark(
  markId: string,
  input: { mechanic_id: string; relation: Agency }
): Promise<{ error: string | null }> {
  const { error } = await supabase
    .from("card_mechanic_marks")
    .update({
      mechanic_id: input.mechanic_id,
      relation: input.relation,
      updated_at: new Date().toISOString(),
    })
    .eq("id", markId);
  return { error: error?.message ?? null };
}

export async function voteMark(
  userId: string,
  markId: string,
  kind: "endorse" | "flag"
): Promise<{ error: string | null }> {
  const { error } = await supabase.from("card_mechanic_votes").upsert({
    mark_id: markId,
    user_id: userId,
    kind,
  });
  if (error) return { error: error.message };
  const { data: votes } = await supabase
    .from("card_mechanic_votes")
    .select("kind")
    .eq("mark_id", markId);
  const endorse = (votes ?? []).filter((v: { kind: string }) => v.kind === "endorse").length;
  const flag = (votes ?? []).filter((v: { kind: string }) => v.kind === "flag").length;
  let status: MarkStatus = flag > 0 ? "flagged" : endorse >= 3 ? "accepted" : "proposed";
  const { data: row } = await supabase
    .from("card_mechanic_marks")
    .select("status")
    .eq("id", markId)
    .maybeSingle();
  if ((row as { status?: string } | null)?.status === "locked") status = "locked";
  await supabase
    .from("card_mechanic_marks")
    .update({
      endorse_count: endorse,
      flag_count: flag,
      status,
      updated_at: new Date().toISOString(),
    })
    .eq("id", markId);
  return { error: null };
}

export async function lockMark(
  adminId: string,
  markId: string,
  locked: boolean
): Promise<{ error: string | null }> {
  const { error } = await supabase
    .from("card_mechanic_marks")
    .update({
      status: locked ? "locked" : "accepted",
      locked_by: locked ? adminId : null,
      updated_at: new Date().toISOString(),
    })
    .eq("id", markId);
  return { error: error?.message ?? null };
}

/** Confirm or reject a plotted mechanic so the community table can learn it. */
export async function submitVerdict(
  userId: string,
  oracleId: string,
  mechanicId: string,
  verdict: "validate" | "nullify"
): Promise<{ error: string | null }> {
  const { data, error } = await supabase
    .from("card_mechanic_marks")
    .select("id")
    .eq("oracle_id", oracleId)
    .eq("mechanic_id", mechanicId)
    .limit(1);
  if (error) return { error: error.message };
  let id = (data?.[0] as { id?: string } | undefined)?.id;
  if (!id) {
    const created = await proposeMark(userId, {
      oracle_id: oracleId,
      mechanic_id: mechanicId,
      relation: "both",
    });
    if (!created.mark) return { error: created.error ?? "Could not record that." };
    id = created.mark.id;
  }
  return voteMark(userId, id, verdict === "validate" ? "endorse" : "flag");
}
