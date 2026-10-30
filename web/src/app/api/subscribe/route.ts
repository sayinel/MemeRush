// Email CTA submissions. With SUPABASE_URL set (production) they go to the email_subscribers table
// (email unique, created_at, unsubscribed_at, source). Without it (PC demo server) they go to a local JSONL file.
// Never log the email address (personal data).
import { promises as fs } from "node:fs";
import path from "node:path";
import { jsonError, readJson } from "@/lib/api";
import { supabaseAdmin } from "@/lib/supabase";

const FILE = process.env.SUBSCRIBERS_FILE || path.join(process.cwd(), ".data", "subscribers.jsonl");
const EMAIL = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

async function saveToFile(email: string, lang: string, src: string | null) {
  const existing = await fs.readFile(FILE, "utf8").catch((e: NodeJS.ErrnoException) => (e.code === "ENOENT" ? "" : Promise.reject(e)));
  // A duplicate address counts as success (nothing more to store).
  const dup = existing.split("\n").some((line) => {
    try {
      return line && JSON.parse(line).email === email;
    } catch {
      return false;
    }
  });
  if (!dup) {
    await fs.mkdir(path.dirname(FILE), { recursive: true });
    await fs.appendFile(FILE, JSON.stringify({ email, lang, src, at: new Date().toISOString() }) + "\n");
  }
}

export async function POST(request: Request) {
  const body = await readJson(request);
  const email = typeof body?.email === "string" ? body.email.trim().toLowerCase() : "";
  if (email.length > 254 || !EMAIL.test(email)) return jsonError(400, "invalid email");
  const lang = body?.lang === "ko" ? "ko" : "en";
  const src = typeof body?.src === "string" ? body.src.replace(/[^\w.-]/g, "").slice(0, 40) : null;

  try {
    if (process.env.SUPABASE_URL) {
      // A duplicate address (unique violation 23505) counts as success.
      const { error } = await supabaseAdmin().from("email_subscribers").insert({ email, lang, source: src });
      if (error && error.code !== "23505") return jsonError(500, "could not save");
    } else {
      await saveToFile(email, lang, src);
    }
    return Response.json({ ok: true });
  } catch {
    return jsonError(500, "could not save");
  }
}
