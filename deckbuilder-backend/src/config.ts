function flag(name: string, fallback: boolean): boolean {
  const raw = process.env[name];
  if (raw == null || raw === "") return fallback;
  return !["0", "false", "off", "no"].includes(raw.toLowerCase());
}

export const NODE_ENV = process.env.NODE_ENV ?? "development";
export const PORT = Number(process.env.PORT) || 3001;
export const HOST = process.env.HOST || "0.0.0.0";

export const CORS_ORIGINS = (process.env.CORS_ORIGINS || process.env.FRONTEND_ORIGIN || "")
  .split(",")
  .map((s) => s.trim())
  .filter(Boolean);

/** Load Scryfall bulk into process memory. Off by default in production. */
export const BULK_ENABLED = flag("BULK_ENABLED", NODE_ENV !== "production");
