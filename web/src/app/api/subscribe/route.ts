// Email CTA submissions. Never log the email address, the IP or a token (personal data).
//
// Cloudflare (D1 binding): double opt-in flow in lib/sub_flow.ts. The address is stored as 'pending' and gets ONE
// confirmation mail; nothing else is sent until the confirm link's button is pressed. Rate limits per IP
// (CF-Connecting-IP) and per inbox (lower case, +tag removed), and a suppression list for unsubscribed/bounced
// addresses.
// Without D1 (Supabase fallback, PC demo JSONL file): the address is only stored, never mailed.
import { promises as fs } from "node:fs";
import path from "node:path";
import { jsonError, readJson } from "@/lib/api";
import { hasRemoteDb, supabaseAdmin } from "@/lib/supabase";
import { parseEmail, normalizeEmail } from "@/lib/mail_safety";
import { subscribe } from "@/lib/sub_flow";
import { flowDeps } from "@/lib/subscriptions";

const FILE = process.env.SUBSCRIBERS_FILE || path.join(process.cwd(), ".data", "subscribers.jsonl");

async function saveToFile(email: string, lang: string, src: string | null) {
  const existing = await fs.readFile(FILE, "utf8").catch((e: NodeJS.ErrnoException) => (e.code === "ENOENT" ? "" : Promise.reject(e)));
  const norm = normalizeEmail(email);
  const dup = existing.split("\n").some((line) => {
    try {
      return line && normalizeEmail(JSON.parse(line).email) === norm;
    } catch {
      return false;
    }
  });
  if (!dup) {
    await fs.mkdir(path.dirname(FILE), { recursive: true });
    await fs.appendFile(FILE, JSON.stringify({ email, lang, src, at: new Date().toISOString() }) + "\n");
  }
}

// Fallback limiter for the non-D1 paths (per process; the D1 path uses the rate_limits table).
const memHits = new Map<string, { start: number; n: number }>();
function memLimited(ip: string, now: number): boolean {
  const h = memHits.get(ip);
  if (!h || now - h.start >= 60) {
    if (memHits.size > 5000) memHits.clear();
    memHits.set(ip, { start: now, n: 1 });
    return false;
  }
  h.n++;
  return h.n > 3;
}

export async function POST(request: Request) {
  const body = await readJson(request);
  const lang = body?.lang === "ko" ? "ko" : "en";
  const src = typeof body?.src === "string" ? body.src.replace(/[^\w.-]/g, "").slice(0, 40) : null;
  const ip = (request.headers.get("cf-connecting-ip") ?? "").slice(0, 64);

  try {
    const deps = flowDeps(new URL(request.url).host);
    if (deps) {
      const r = await subscribe(deps, { email: body?.email, ip, lang, source: src });
      if (r.status === 400) return jsonError(400, "invalid email");
      if (r.status === 429) return Response.json({ error: "too many requests" }, { status: 429, headers: { "retry-after": "60" } });
      return Response.json({ ok: true }); // same answer for new / known / suppressed addresses
    }

    const email = parseEmail(body?.email);
    if (!email) return jsonError(400, "invalid email");
    if (memLimited(ip || "unknown", Math.floor(Date.now() / 1000))) return jsonError(429, "too many requests");
    if (hasRemoteDb()) {
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
