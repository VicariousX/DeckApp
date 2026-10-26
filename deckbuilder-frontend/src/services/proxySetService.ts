import { supabase } from "../lib/supabaseClient";

export type ProxySet = {
  id: string;
  name: string;
  code: string;
  description: string | null;
  is_public: boolean;
  created_by: string | null;
};

export type ProxySetCard = {
  id: string;
  set_id: string;
  oracle_id: string;
  name: string;
  image_url: string;
  back_image_url: string | null;
};

const DEFAULT_CODE = "PROXY";

export async function ensureDefaultProxySet(userId: string): Promise<{ set: ProxySet | null; error: string | null }> {
  const { data: existing } = await supabase
    .from("proxy_sets")
    .select("*")
    .eq("code", DEFAULT_CODE)
    .maybeSingle();
  if (existing) return { set: existing as ProxySet, error: null };

  const { data, error } = await supabase
    .from("proxy_sets")
    .insert({
      name: "Proxy Set",
      code: DEFAULT_CODE,
      description: "Shared proxy art. Images are hosted on Cloudflare.",
      is_public: true,
      created_by: userId,
    })
    .select("*")
    .maybeSingle();
  if (error) return { set: null, error: error.message };
  return { set: (data as ProxySet) ?? null, error: null };
}

export async function listProxyCards(setId: string): Promise<{ cards: ProxySetCard[]; error: string | null }> {
  const { data, error } = await supabase
    .from("proxy_set_cards")
    .select("*")
    .eq("set_id", setId)
    .order("name", { ascending: true });
  if (error) return { cards: [], error: error.message };
  return { cards: (data ?? []) as ProxySetCard[], error: null };
}

export async function fetchPublicProxyArt(): Promise<{ map: Map<string, ProxySetCard>; error: string | null }> {
  const { data, error } = await supabase
    .from("proxy_set_cards")
    .select("*, proxy_sets!inner(is_public)")
    .eq("proxy_sets.is_public", true);
  if (error) return { map: new Map(), error: error.message };
  const map = new Map<string, ProxySetCard>();
  for (const row of (data ?? []) as ProxySetCard[]) {
    map.set(row.oracle_id.toLowerCase(), row);
  }
  return { map, error: null };
}

export async function upsertProxyCard(
  setId: string,
  input: { oracle_id: string; name: string; image_url: string; back_image_url?: string | null }
): Promise<{ card: ProxySetCard | null; error: string | null }> {
  const { data, error } = await supabase
    .from("proxy_set_cards")
    .upsert(
      {
        set_id: setId,
        oracle_id: input.oracle_id.toLowerCase(),
        name: input.name,
        image_url: input.image_url.trim(),
        back_image_url: input.back_image_url?.trim() || null,
      },
      { onConflict: "set_id,oracle_id" }
    )
    .select("*")
    .maybeSingle();
  if (error) return { card: null, error: error.message };
  return { card: (data as ProxySetCard) ?? null, error: null };
}

export async function deleteProxyCard(id: string): Promise<{ error: string | null }> {
  const { error } = await supabase.from("proxy_set_cards").delete().eq("id", id);
  return { error: error?.message ?? null };
}
