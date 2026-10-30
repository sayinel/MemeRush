// TEMPORARY: stores the email CTA submissions in a local JSONL file and returns 200.
// 탐이 실제 저장소(DB)와 메일 발송으로 교체한다. This file-based version has no mail sending, no unsubscribe,
// and is not durable on serverless hosts. Never log the email address (personal data).
import { promises as fs } from "node:fs";
import path from "node:path";
import { jsonError, readJson } from "@/lib/api";

const FILE = process.env.SUBSCRIBERS_FILE || path.join(process.cwd(), ".data", "subscribers.jsonl");
const EMAIL = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export async function POST(request: Request) {
  const body = await readJson(request);
  const email = typeof body?.email === "string" ? body.email.trim().toLowerCase() : "";
  if (email.length > 254 || !EMAIL.test(email)) return jsonError(400, "invalid email");
  const lang = body?.lang === "ko" ? "ko" : "en";
  const src = typeof body?.src === "string" ? body.src.replace(/[^\w.-]/g, "").slice(0, 40) : null;

  try {
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
    return Response.json({ ok: true });
  } catch {
    return jsonError(500, "could not save");
  }
}
