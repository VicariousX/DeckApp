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

/** Direct API origin for WebSockets. Cloudflare Pages cannot proxy the upgrade. */
export function tableSocketUrl(room: string, role: "host" | "guest", name: string): string {
  const explicit = (import.meta.env.VITE_WS_URL as string | undefined)?.trim();
  const httpBase = explicit || apiBase() || "http://127.0.0.1:3001";
  const wsBase = httpBase.replace(/^http/, "ws");
  const q = new URLSearchParams({ room, role, name });
  return `${wsBase.replace(/\/$/, "")}/api/tables/socket?${q}`;
}
