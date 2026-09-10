import { createClient } from "@supabase/supabase-js";

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL as string | undefined;
const supabasePublishableKey = import.meta.env
  .VITE_SUPABASE_PUBLISHABLE_KEY as string | undefined;

if (!supabaseUrl || !supabasePublishableKey) {
  // Fail early in dev so missing env is obvious
  console.warn(
    "[supabase] Missing VITE_SUPABASE_URL or VITE_SUPABASE_PUBLISHABLE_KEY. " +
      "Copy .env.example to .env.local and fill in your project values."
  );
}

/**
 * Browser Supabase client.
 * Uses the publishable key only — RLS enforces access control.
 */
export const supabase = createClient(
  supabaseUrl ?? "",
  supabasePublishableKey ?? ""
);
