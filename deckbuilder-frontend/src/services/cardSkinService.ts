import { supabase } from "../lib/supabaseClient";
import { cardArtPublicUrl } from "./cardArtService";

const BUCKET = "card-art";

export type UserCardSkin = {
  id: string;
  user_id: string;
  name: string;
  storage_path: string;
  is_public: boolean;
  created_at: string;
};

export function skinImageUrl(path: string | null | undefined): string {
  return cardArtPublicUrl(path);
}

export async function fetchMyCardSkins(
  userId: string
): Promise<{ skins: UserCardSkin[]; error: string | null }> {
  const { data, error } = await supabase
    .from("user_card_skins")
    .select("*")
    .eq("user_id", userId)
    .order("created_at", { ascending: false });
  if (error) return { skins: [], error: error.message };
  return { skins: (data ?? []) as UserCardSkin[], error: null };
}

export async function uploadCardSkin(
  userId: string,
  name: string,
  file: File,
  isPublic: boolean
): Promise<{ skin: UserCardSkin | null; error: string | null }> {
  const allowed = ["image/png", "image/jpeg", "image/webp"];
  if (!allowed.includes(file.type)) {
    return { skin: null, error: "Use a PNG, JPEG, or WebP image." };
  }
  if (file.size > 5 * 1024 * 1024) {
    return { skin: null, error: "Image must be 5 MB or smaller." };
  }
  const trimmed = name.trim();
  if (!trimmed) return { skin: null, error: "Name the skin first." };

  const id = crypto.randomUUID();
  const ext = file.type === "image/png" ? "png" : file.type === "image/webp" ? "webp" : "jpg";
  const path = `${userId}/skins/${id}.${ext}`;
  const { error: uploadError } = await supabase.storage.from(BUCKET).upload(path, file, {
    upsert: false,
    contentType: file.type,
    cacheControl: "3600",
  });
  if (uploadError) return { skin: null, error: uploadError.message };

  const { data, error } = await supabase
    .from("user_card_skins")
    .insert({
      id,
      user_id: userId,
      name: trimmed,
      storage_path: path,
      is_public: isPublic,
    })
    .select("*")
    .single();
  if (error) {
    await supabase.storage.from(BUCKET).remove([path]);
    return { skin: null, error: error.message };
  }
  return { skin: data as UserCardSkin, error: null };
}

export async function setCardSkinPublic(
  id: string,
  isPublic: boolean
): Promise<{ error: string | null }> {
  const { error } = await supabase.from("user_card_skins").update({ is_public: isPublic }).eq("id", id);
  return { error: error?.message ?? null };
}

export async function deleteCardSkin(
  skin: UserCardSkin
): Promise<{ error: string | null }> {
  if (skin.storage_path) {
    await supabase.storage.from(BUCKET).remove([skin.storage_path]);
  }
  const { error } = await supabase.from("user_card_skins").delete().eq("id", skin.id);
  return { error: error?.message ?? null };
}
