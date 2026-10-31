// Newsletter ("밈레터") send endpoint. POST only, protected by the NEWSLETTER_SEND_KEY secret (header x-newsletter-key).
// Without the secret the route answers 404, so it does not exist on deployments that did not set it.
//   {issueNo, dateLabel, videoUrl, test: ["a@simplifier.co.kr", ...]}              -> internal test send (max 5, @simplifier.co.kr only)
//   {issueNo, dateLabel, videoUrl, all: true, confirm: "SEND #001"}                 -> every active subscriber, once per issue
// The answer carries counts only, never an address. Never log addresses, tokens or the key.
import { readJson } from "@/lib/api";
import { cloudflareD1 } from "@/lib/supabase";
import { SubStore } from "@/lib/sub_flow";
import { parseEmail, normalizeEmail } from "@/lib/mail_safety";
import { makeToken, hashesForAllKeys } from "@/lib/sub_token";
import { keyRing } from "@/lib/unsub";
import { sendMail } from "@/lib/mailer";
import { mailEnv, siteHostEnv, newsletterKeyEnv } from "@/lib/mail_env";
import { currentChallengeId } from "@/lib/challenge";
import { runNewsletter, validateJob } from "@/lib/newsletter_send";
import { LIMITS } from "@/lib/sub_flow";

export const dynamic = "force-dynamic";

async function sameSecret(a: string, b: string): Promise<boolean> {
  const enc = new TextEncoder();
  const [x, y] = await Promise.all([crypto.subtle.digest("SHA-256", enc.encode(a)), crypto.subtle.digest("SHA-256", enc.encode(b))]);
  const xa = new Uint8Array(x);
  const ya = new Uint8Array(y);
  let diff = 0;
  for (let i = 0; i < xa.length; i++) diff |= xa[i] ^ ya[i];
  return diff === 0;
}

export async function POST(request: Request) {
  const key = newsletterKeyEnv();
  if (!key) return new Response("Not found", { status: 404 });
  if (!(await sameSecret(request.headers.get("x-newsletter-key") ?? "", key))) return Response.json({ error: "unauthorized" }, { status: 401 });

  const v = validateJob(await readJson(request));
  if (!v.ok) return Response.json({ error: v.error }, { status: 400 });

  const db = cloudflareD1();
  const ring = keyRing();
  if (!db || !ring) return Response.json({ error: "not configured" }, { status: 503 });
  const store = new SubStore(db);
  const host = siteHostEnv() || new URL(request.url).host;
  const env = mailEnv();
  const report = await runNewsletter(
    {
      host,
      challengeId: currentChallengeId(),
      replyAddress: "memerush@superagents.run", // 문의(CS) 주소. 발신 DoNotReply는 답장을 받지 않는다(사장님 10/31)
      nowSec: Math.floor(Date.now() / 1000),
      parseEmail,
      normalizeEmail,
      findByAddress: (norm, email) => store.findByAddress(norm, email) as Promise<{ id: string; email: string; lang: string } | null>,
      listActive: (limit) => store.listActive(limit) as Promise<{ id: string; email: string; lang: string }[]>,
      isSuppressedAddress: async (norm) => store.isSuppressed(await hashesForAllKeys(ring, "sup", norm)),
      unsubToken: (subId) => makeToken(ring, "u", subId, Math.floor(Date.now() / 1000) + LIMITS.unsubTtlSec),
      claim: async (k, now, win) => (await store.hit(k, win, now)) === 1,
      release: (k) => store.release(k),
      send: async (to, mail) => {
        try {
          const r = await sendMail(env, { to, ...mail });
          return r.ok ? { ok: true } : { ok: false, reason: r.reason };
        } catch {
          return { ok: false, reason: "exception" };
        }
      },
    },
    v.job,
  );
  return Response.json({ ok: true, report }, { headers: { "cache-control": "no-store" } });
}
