// Next-game vote. POST {choice, ref?}. One vote per ref (pressing again changes the choice).
// ref = subscriber ref from the mail link; without it an anonymous cookie id ("anon:<id>") is used.
// Storage: D1 `votes` table (migration 0003). Without D1 (PC demo) the vote goes to a JSONL file, last vote per ref wins.
// Never log the ref, the IP or the cookie id.
import { promises as fs } from "node:fs";
import path from "node:path";
import { jsonError, readJson } from "@/lib/api";
import { cloudflareD1 } from "@/lib/supabase";
import { SubStore } from "@/lib/sub_flow";
import { VOTE_CHOICES } from "@/lib/mail/newsletter";

const FILE = process.env.VOTES_FILE || path.join(process.cwd(), ".data", "votes.jsonl");
const REF_OK = /^[A-Za-z0-9_.:-]{1,64}$/;
const COOKIE = "mr_vref";

async function ipKey(ip: string): Promise<string> {
  const buf = await crypto.subtle.digest("SHA-256", new TextEncoder().encode("vote:" + ip));
  return "vt:" + [...new Uint8Array(buf).slice(0, 12)].map((b) => b.toString(16).padStart(2, "0")).join("");
}

const memHits = new Map<string, { start: number; n: number }>();
function memLimited(ip: string, now: number): boolean {
  const h = memHits.get(ip);
  if (!h || now - h.start >= 60) {
    if (memHits.size > 5000) memHits.clear();
    memHits.set(ip, { start: now, n: 1 });
    return false;
  }
  h.n++;
  return h.n > 20;
}

export async function POST(request: Request) {
  const body = await readJson(request);
  const choice = body?.choice;
  if (typeof choice !== "string" || !VOTE_CHOICES.some((c) => c.key === choice)) return jsonError(400, "invalid choice");
  const rawRef = body?.ref;
  if (rawRef != null && rawRef !== "" && (typeof rawRef !== "string" || !REF_OK.test(rawRef))) return jsonError(400, "invalid ref");

  const cookieId = /(?:^|;\s*)mr_vref=([A-Za-z0-9-]{8,64})/.exec(request.headers.get("cookie") ?? "")?.[1];
  const newCookie = !rawRef && !cookieId ? crypto.randomUUID() : null;
  const ref = rawRef ? String(rawRef) : "anon:" + (cookieId ?? newCookie);
  const ip = (request.headers.get("cf-connecting-ip") ?? "").slice(0, 64);
  const now = Math.floor(Date.now() / 1000);

  try {
    const db = cloudflareD1();
    if (db) {
      if ((await new SubStore(db).hit(await ipKey(ip), 60, now)) > 20) {
        return Response.json({ error: "too many requests" }, { status: 429, headers: { "retry-after": "60" } });
      }
      await db
        .prepare("insert into votes (ref, choice) values (?, ?) on conflict(ref) do update set choice = excluded.choice")
        .bind(ref, choice)
        .all();
    } else {
      if (memLimited(ip || "unknown", now)) return jsonError(429, "too many requests");
      await fs.mkdir(path.dirname(FILE), { recursive: true });
      await fs.appendFile(FILE, JSON.stringify({ ref, choice, at: new Date().toISOString() }) + "\n");
    }
    const headers = new Headers();
    if (newCookie) headers.append("set-cookie", `${COOKIE}=${newCookie}; Path=/; Max-Age=31536000; HttpOnly; SameSite=Lax; Secure`);
    return Response.json({ ok: true }, { headers });
  } catch {
    return jsonError(500, "could not save");
  }
}
