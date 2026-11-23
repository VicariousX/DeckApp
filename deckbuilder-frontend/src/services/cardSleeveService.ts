import type { User } from "@supabase/supabase-js";
import { getDisplayName } from "../auth/userDisplay";
import { supabase } from "../lib/supabaseClient";
import { cardArtPublicUrl } from "./cardArtService";

const BUCKET = "card-art";
const SLEEVE_LIMIT = 5;

export type CardSleeve = {
  id: string;
  user_id: string;
  name: string;
  storage_path: string;
  is_public: boolean;
  created_at: string;
};

export function sleeveUnlimited(user: User | null | undefined): boolean {
  if (!user) return false;
  const name = getDisplayName(user).trim().toLowerCase();
  const email = (user.email || "").toLowerCase();
  return name === "vicariousx" || email.includes("vicariousx");
}

export function sleeveImageUrl(path: string | null | undefined): string {
  return cardArtPublicUrl(path);
}

export async function fetchMySleeves(
  userId: string
): Promise<{ sleeves: CardSleeve[]; error: string | null }> {
  const { data, error } = await supabase
    .from("card_sleeves")
    .select("*")
    .eq("user_id", userId)
    .order("created_at", { ascending: false });
  if (error) return { sleeves: [], error: error.message };
  return { sleeves: (data ?? []) as CardSleeve[], error: null };
}

export async function fetchPublicSleeves(): Promise<{ sleeves: CardSleeve[]; error: string | null }> {
  const { data, error } = await supabase
    .from("card_sleeves")
    .select("*")
    .eq("is_public", true)
    .order("created_at", { ascending: false })
    .limit(200);
  if (error) return { sleeves: [], error: error.message };
  return { sleeves: (data ?? []) as CardSleeve[], error: null };
}

export async function uploadCardSleeve(
  user: User,
  name: string,
  file: File,
  isPublic: boolean
): Promise<{ sleeve: CardSleeve | null; error: string | null }> {
  const allowed = ["image/png", "image/jpeg", "image/webp"];
  if (!allowed.includes(file.type)) {
    return { sleeve: null, error: "Use a PNG, JPEG, or WebP image." };
  }
  if (file.size > 5 * 1024 * 1024) {
    return { sleeve: null, error: "Image must be 5 MB or smaller." };
  }
  const trimmed = name.trim();
  if (!trimmed) return { sleeve: null, error: "Name the sleeve first." };

  if (!sleeveUnlimited(user)) {
    const { count, error: countError } = await supabase
      .from("card_sleeves")
      .select("id", { count: "exact", head: true })
      .eq("user_id", user.id);
    if (countError) return { sleeve: null, error: countError.message };
    if ((count ?? 0) >= SLEEVE_LIMIT) {
      return { sleeve: null, error: `You can upload ${SLEEVE_LIMIT} sleeves.` };
    }
  }

  const id = crypto.randomUUID();
  const ext = file.type === "image/png" ? "png" : file.type === "image/webp" ? "webp" : "jpg";
  const path = `${user.id}/sleeves/${id}.${ext}`;
  const { error: uploadError } = await supabase.storage.from(BUCKET).upload(path, file, {
    upsert: false,
    contentType: file.type,
    cacheControl: "3600",
  });
  if (uploadError) return { sleeve: null, error: uploadError.message };

  const { data, error } = await supabase
    .from("card_sleeves")
    .insert({
      id,
      user_id: user.id,
      name: trimmed,
      storage_path: path,
      is_public: isPublic,
    })
    .select("*")
    .single();
  if (error) {
    await supabase.storage.from(BUCKET).remove([path]);
    return { sleeve: null, error: error.message };
  }
  return { sleeve: data as CardSleeve, error: null };
}

export async function setCardSleevePublic(
  id: string,
  isPublic: boolean
): Promise<{ error: string | null }> {
  const { error } = await supabase.from("card_sleeves").update({ is_public: isPublic }).eq("id", id);
  return { error: error?.message ?? null };
}

export async function deleteCardSleeve(
  sleeve: CardSleeve
): Promise<{ error: string | null }> {
  if (sleeve.storage_path) {
    await supabase.storage.from(BUCKET).remove([sleeve.storage_path]);
  }
  const { error } = await supabase.from("card_sleeves").delete().eq("id", sleeve.id);
  return { error: error?.message ?? null };
}
