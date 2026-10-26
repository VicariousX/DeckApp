import type { User } from "@supabase/supabase-js";

/**
 * Proxy-set admin is restricted to the owner account.
 * Add emails here to lock it to specific accounts; the display-name
 * fallback keeps it usable until the email is added.
 */
const PROXY_ADMIN_EMAILS = new Set<string>([
  // "you@example.com",
]);

const PROXY_ADMIN_NAMES = new Set<string>(["jordan klein"]);

export function isProxyAdmin(user: User | null | undefined): boolean {
  if (!user) return false;
  const email = (user.email ?? "").trim().toLowerCase();
  if (email && PROXY_ADMIN_EMAILS.has(email)) return true;
  const name = String(user.user_metadata?.display_name ?? "").trim().toLowerCase();
  return PROXY_ADMIN_NAMES.has(name);
}
