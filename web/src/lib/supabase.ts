import "server-only";
import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import { localDb } from "@/lib/localdb";

let client: SupabaseClient | undefined;

// Service-role client. Every DB access goes through Next.js API routes (MVP_SCOPE 2절 "DB 접근").
export function supabaseAdmin(): SupabaseClient {
  if (!client) {
    const url = process.env.SUPABASE_URL;
    const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
    if (!url || !key) {
      // Local test stand-in (see localdb.ts): only without Supabase keys, and outside production unless LOCAL_PLAY=1.
      if (process.env.NODE_ENV !== "production" || process.env.LOCAL_PLAY === "1") {
        client = localDb() as unknown as SupabaseClient;
        return client;
      }
      throw new Error("SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY must be set");
    }
    if (new URL(url).pathname !== "/") throw new Error("SUPABASE_URL must be the project URL only (https://<ref>.supabase.co), without /rest/v1");
    client = createClient(url, key, { auth: { persistSession: false } });
  }
  return client;
}
