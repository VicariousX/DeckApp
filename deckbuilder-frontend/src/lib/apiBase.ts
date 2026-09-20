/**
 * Backend origin. Empty string = same host (Vite proxy in dev, Cloudflare
 * /api proxy in prod). Override with VITE_API_URL for a direct Render URL.
 */
export function apiBase(): string {
  const raw = (import.meta.env.VITE_API_URL as string | undefined)?.trim();
  if (!raw) return "";
  return raw.replace(/\/$/, "");
}

export function apiUrl(path: string): string {
  const raw = path.trim();
  if (!raw || raw === "/") return apiBase() || "";
  const p = raw.startsWith("/") ? raw : `/${raw}`;
  return `${apiBase()}${p}`;
}
