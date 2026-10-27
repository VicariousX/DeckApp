import type { User } from "@supabase/supabase-js";
import { getDisplayName } from "../auth/userDisplay";

/**
 * Proxy-set admin is restricted to the owner account.
 * Add emails here to lock it to specific accounts.
 */
const PROXY_ADMIN_EMAILS = new Set<string>([
  // "you@example.com",
]);

const PROXY_ADMIN_NAMES = new Set<string>(["vicariousx"]);

export function isProxyAdmin(user: User | null | undefined): boolean {
  if (!user) return false;
  const email = (user.email ?? "").trim().toLowerCase();
  if (email && PROXY_ADMIN_EMAILS.has(email)) return true;
  const local = email.split("@")[0];
  if (local && PROXY_ADMIN_NAMES.has(local)) return true;
  const name = getDisplayName(user).trim().toLowerCase();
  return PROXY_ADMIN_NAMES.has(name);
}
