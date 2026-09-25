import { supabase } from "../lib/supabaseClient";
import type { Agency, Economy, Flow } from "../lib/mechanics/catalog";

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
  economy: Economy;
  flow: Flow;
  agency: Agency;
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
      "id, oracle_id, mechanic_id, economy, flow, agency, status, proposed_by, endorse_count, flag_count"
    )
    .in("oracle_id", oracleIds)
    .in("status", VISIBLE)
    .order("updated_at", { ascending: false });
  if (error) return { marks: [], error: error.message };
  return { marks: (data ?? []) as MechanicMark[], error: null };
}

export async function oracleIdsForMechanic(
  mechanicId: string,
  economy?: Economy
): Promise<{ ids: string[]; error: string | null }> {
  let q = supabase
    .from("card_mechanic_marks")
    .select("oracle_id")
    .eq("mechanic_id", mechanicId)
    .in("status", ["accepted", "locked"]);
  if (economy && economy !== "both") q = q.in("economy", [economy, "both"]);
  const { data, error } = await q;
  if (error) return { ids: [], error: error.message };
  return {
    ids: [...new Set((data ?? []).map((r: { oracle_id: string }) => r.oracle_id))],
    error: null,
  };
}

export async function proposeMark(
  userId: string,
  input: {
    oracle_id: string;
    mechanic_id: string;
    economy: Economy;
    flow: Flow;
    agency: Agency;
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
      "id, oracle_id, mechanic_id, economy, flow, agency, status, proposed_by, endorse_count, flag_count"
    )
    .maybeSingle();
  if (error) return { mark: null, error: error.message };
  return { mark: data as MechanicMark, error: null };
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
