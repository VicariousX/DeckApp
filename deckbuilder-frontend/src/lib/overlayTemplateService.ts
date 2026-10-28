import { supabase } from "../lib/supabaseClient";
import type { OverlayTemplate } from "./overlayTemplates";

export async function loadTemplatesRemote(): Promise<{ templates: OverlayTemplate[]; error: string | null }> {
  const { data, error } = await supabase
    .from("overlay_templates")
    .select("*")
    .order("updated_at", { ascending: false });
  if (error) return { templates: [], error: error.message };
  const templates = ((data ?? []) as Array<{ id: string; name: string; elements: unknown; updated_at: string }>).map((row) => ({
    id: row.id,
    name: row.name,
    elements: Array.isArray(row.elements) ? row.elements : [],
    updatedAt: row.updated_at,
  })) as OverlayTemplate[];
  return { templates, error: null };
}

export async function upsertTemplateRemote(template: OverlayTemplate): Promise<{ error: string | null }> {
  const { data: userData } = await supabase.auth.getUser();
  const { error } = await supabase.from("overlay_templates").upsert({
    id: template.id,
    name: template.name,
    elements: template.elements,
    created_by: userData.user?.id ?? null,
    updated_at: new Date().toISOString(),
  });
  return { error: error?.message ?? null };
}

export async function deleteTemplateRemote(id: string): Promise<{ error: string | null }> {
  const { error } = await supabase.from("overlay_templates").delete().eq("id", id);
  return { error: error?.message ?? null };
}
