import "server-only";
import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import { getCloudflareContext } from "@opennextjs/cloudflare";
import { localDb } from "@/lib/localdb";
import { d1Db, type D1Like } from "@/lib/d1db";

let client: SupabaseClient | undefined;

// Storage choice by runtime: Cloudflare binding `DB` (D1) first; otherwise the existing paths (Supabase keys, or the
// local stand-in for the PC demo server). The Supabase code stays as the fallback (kept for rollback).
export function cloudflareD1(): D1Like | null {
  try {
    const db = (getCloudflareContext().env as { DB?: D1Like }).DB;
    return db ?? null;
  } catch {
    return null; // not inside a Cloudflare request (next dev/start on the PC)
  }
}

// Service-role client. Every DB access goes through Next.js API routes (MVP_SCOPE 2절 "DB 접근").
export function supabaseAdmin(): SupabaseClient {
  const d1 = cloudflareD1();
  if (d1) return d1Db(d1) as unknown as SupabaseClient;
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

// True when subscribers go to a database (D1 binding or Supabase) instead of the PC demo JSONL file.
export function hasRemoteDb(): boolean {
  return !!cloudflareD1() || !!process.env.SUPABASE_URL;
}
