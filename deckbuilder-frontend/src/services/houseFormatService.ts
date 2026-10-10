import { supabase } from "../lib/supabaseClient";
import type { HouseFormat } from "../lib/formats/rules";

const KEY = "deckapp-house-formats";

export function loadHouseFormats(): HouseFormat[] {
  try {
    const raw = localStorage.getItem(KEY);
    const list = raw ? (JSON.parse(raw) as HouseFormat[]) : [];
    return Array.isArray(list)
      ? list.map((f) => ({
          ...blankHouseFormat(),
          ...f,
          id: f.id,
          whitelist: f.whitelist ?? [],
          copyOverrides: f.copyOverrides ?? [],
          rules: f.rules ?? [],
          basedOn: f.basedOn ?? f.legalityKey ?? "commander",
        }))
      : [];
  } catch {
    return [];
  }
}

export function saveHouseFormats(formats: HouseFormat[]) {
  localStorage.setItem(KEY, JSON.stringify(formats));
}

export async function loadRemoteHouseFormats(userId: string): Promise<HouseFormat[]> {
  const { data } = await supabase.from("house_formats").select("id, name, rules").eq("user_id", userId);
  return (data ?? []).map((row) => ({
    ...blankHouseFormat(),
    ...(row.rules as HouseFormat),
    id: row.id as string,
    name: row.name as string,
  }));
}

export async function saveRemoteHouseFormat(userId: string, format: HouseFormat) {
  return supabase.from("house_formats").upsert({
    id: format.id,
    user_id: userId,
    name: format.name,
    rules: format,
    is_public: format.isPublic,
    updated_at: new Date().toISOString(),
  });
}

export async function deleteRemoteHouseFormat(id: string) {
  return supabase.from("house_formats").delete().eq("id", id);
}

export async function listGroupFormats(groupId: string): Promise<HouseFormat[]> {
  const { data } = await supabase.from("group_formats").select("id, name, rules").eq("group_id", groupId);
  return (data ?? []).map((row) => ({
    ...blankHouseFormat(),
    ...(row.rules as HouseFormat),
    id: row.id as string,
    name: row.name as string,
  }));
}

export async function saveGroupFormat(groupId: string, userId: string, format: HouseFormat) {
  return supabase.from("group_formats").insert({
    group_id: groupId,
    name: format.name,
    rules: format,
    created_by: userId,
  });
}

export function blankHouseFormat(): HouseFormat {
  return {
    id: crypto.randomUUID(),
    name: "House format",
    basedOn: "commander",
    deckSize: 100,
    sideboardSize: 0,
    copyLimit: 1,
    singleton: true,
    commanderRequired: true,
    colorIdentity: true,
    legalityKey: "commander",
    banned: [],
    restricted: [],
    whitelist: [],
    copyOverrides: [],
    rules: [],
    notes: "",
    isPublic: false,
  };
}
