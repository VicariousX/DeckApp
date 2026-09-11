import { supabase } from "../lib/supabaseClient";
import type { UserCardArt, UserCardArtUpsert } from "../types/deckAppCard";

const BUCKET = "card-art";

function publicStorageBase(): string {
  const url = import.meta.env.VITE_SUPABASE_URL as string | undefined;
  if (!url) return "";
  return `${url.replace(/\/$/, "")}/storage/v1/object/public/${BUCKET}`;
}

export function getCardArtPublicBase(): string {
  return publicStorageBase();
}

/** Public URL for a storage path inside the card-art bucket. */
export function cardArtPublicUrl(path: string | null | undefined): string {
  if (!path) return "";
  const base = publicStorageBase();
  if (!base) return "";
  return `${base}/${path.replace(/^\//, "")}`;
}

/**
 * Load all art preferences for the signed-in user.
 * Returns a Map keyed by oracle_id for fast merge.
 */
export async function fetchUserCardArtMap(
  userId: string
): Promise<{ map: Map<string, UserCardArt>; error: string | null }> {
  const { data, error } = await supabase
    .from("user_card_art")
    .select("*")
    .eq("user_id", userId);

  if (error) {
    return { map: new Map(), error: error.message };
  }

  const map = new Map<string, UserCardArt>();
  for (const row of (data ?? []) as UserCardArt[]) {
    map.set(String(row.oracle_id).toLowerCase(), {
      ...row,
      oracle_id: String(row.oracle_id).toLowerCase(),
      preferred_scryfall_id: row.preferred_scryfall_id
        ? String(row.preferred_scryfall_id).toLowerCase()
        : null,
    });
  }
  return { map, error: null };
}

/** Load preference for a single oracle card. */
export async function fetchUserCardArt(
  userId: string,
  oracleId: string
): Promise<{ art: UserCardArt | null; error: string | null }> {
  const { data, error } = await supabase
    .from("user_card_art")
    .select("*")
    .eq("user_id", userId)
    .eq("oracle_id", oracleId)
    .maybeSingle();

  if (error) return { art: null, error: error.message };
  return { art: (data as UserCardArt) ?? null, error: null };
}

/**
 * Insert or update the user's art preference for an oracle card.
 * Only provided fields are written; pass null to clear a custom path / preferred id.
 */
export async function upsertUserCardArt(
  userId: string,
  patch: UserCardArtUpsert
): Promise<{ art: UserCardArt | null; error: string | null }> {
  // When only some fields are intended to change, merge with existing row
  const { art: existing } = await fetchUserCardArt(userId, patch.oracle_id);
  const merged = {
    user_id: userId,
    oracle_id: patch.oracle_id,
    preferred_scryfall_id:
      patch.preferred_scryfall_id !== undefined
        ? patch.preferred_scryfall_id
        : (existing?.preferred_scryfall_id ?? null),
    custom_front_path:
      patch.custom_front_path !== undefined
        ? patch.custom_front_path
        : (existing?.custom_front_path ?? null),
    custom_back_path:
      patch.custom_back_path !== undefined
        ? patch.custom_back_path
        : (existing?.custom_back_path ?? null),
    notes:
      patch.notes !== undefined ? patch.notes : (existing?.notes ?? null),
  };

  const { data, error } = await supabase
    .from("user_card_art")
    .upsert(merged, { onConflict: "user_id,oracle_id" })
    .select("*")
    .maybeSingle();

  if (error) return { art: null, error: error.message };
  return { art: (data as UserCardArt) ?? null, error: null };
}

export async function deleteUserCardArt(
  userId: string,
  oracleId: string
): Promise<{ error: string | null }> {
  const { error } = await supabase
    .from("user_card_art")
    .delete()
    .eq("user_id", userId)
    .eq("oracle_id", oracleId);
  return { error: error?.message ?? null };
}

export type CardFaceSide = "front" | "back";

function extensionForMime(mime: string): string {
  if (mime === "image/png") return "png";
  if (mime === "image/webp") return "webp";
  if (mime === "image/gif") return "gif";
  return "jpg";
}

/**
 * Upload a custom card image for the user.
 * Path: `{userId}/{oracleId}/{front|back}.{ext}`
 * Updates user_card_art with the new path.
 */
export async function uploadCustomCardImage(
  userId: string,
  oracleId: string,
  side: CardFaceSide,
  file: File
): Promise<{ path: string | null; publicUrl: string; error: string | null }> {
  const allowed = ["image/png", "image/jpeg", "image/webp", "image/gif"];
  if (!allowed.includes(file.type)) {
    return {
      path: null,
      publicUrl: "",
      error: "Only PNG, JPEG, WebP, or GIF images are allowed.",
    };
  }
  if (file.size > 5 * 1024 * 1024) {
    return {
      path: null,
      publicUrl: "",
      error: "Image must be 5 MB or smaller.",
    };
  }

  const ext = extensionForMime(file.type);
  const path = `${userId}/${oracleId}/${side}.${ext}`;

  const { error: uploadError } = await supabase.storage
    .from(BUCKET)
    .upload(path, file, {
      upsert: true,
      contentType: file.type,
      cacheControl: "3600",
    });

  if (uploadError) {
    return { path: null, publicUrl: "", error: uploadError.message };
  }

  const patch: UserCardArtUpsert = {
    oracle_id: oracleId,
    ...(side === "front"
      ? { custom_front_path: path }
      : { custom_back_path: path }),
  };

  const { error: dbError } = await upsertUserCardArt(userId, patch);
  if (dbError) {
    return { path: null, publicUrl: "", error: dbError };
  }

  return {
    path,
    publicUrl: cardArtPublicUrl(path),
    error: null,
  };
}

/**
 * Remove a custom image side and clear the path on the preference row.
 * Does not delete the preference row entirely.
 */
export async function removeCustomCardImage(
  userId: string,
  oracleId: string,
  side: CardFaceSide
): Promise<{ error: string | null }> {
  const { art } = await fetchUserCardArt(userId, oracleId);
  const path =
    side === "front" ? art?.custom_front_path : art?.custom_back_path;

  if (path) {
    await supabase.storage.from(BUCKET).remove([path]);
  }

  const patch: UserCardArtUpsert = {
    oracle_id: oracleId,
    ...(side === "front"
      ? { custom_front_path: null }
      : { custom_back_path: null }),
  };

  const { error } = await upsertUserCardArt(userId, patch);
  return { error };
}
