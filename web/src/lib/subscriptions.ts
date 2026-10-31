import "server-only";
import { getCloudflareContext } from "@opennextjs/cloudflare";
import { cloudflareD1 } from "@/lib/supabase";
import { SubStore, type FlowDeps } from "@/lib/sub_flow";
import { parseEmail, normalizeEmail } from "@/lib/mail_safety";
import { makeToken, verifyToken, hashesForAllKeys, hashForCurrentKey } from "@/lib/sub_token";
import { keyRing } from "@/lib/unsub";
import { sendMail } from "@/lib/mailer";
import { mailEnv, siteHostEnv } from "@/lib/mail_env";
import { buildConfirmMail, buildWelcomeMail, type BuiltMail } from "@/lib/mail_templates";
import { currentChallengeId } from "@/lib/challenge";
import { logEvent } from "@/lib/session";

// Server glue for sub_flow.ts: D1 store, signing keys, mail sending. Returns null without the D1 binding
// (PC demo / Supabase fallback): the double opt-in state lives only in D1, so those paths never send mail.

async function send(to: string, mail: BuiltMail) {
  try {
    const r = await sendMail(mailEnv(), { to, ...mail });
    // Reason only, never the address. (Audit C7: failures are capped by the subscribe rate limits.)
    if (!r.ok && r.reason !== "disabled") await logEvent("mail_failed", { meta: { reason: r.reason } });
  } catch {
    await logEvent("mail_failed", { meta: { reason: "exception" } }).catch(() => undefined);
  }
}

// Mail goes out after the response (waitUntil) so response time does not tell whether an address was new.
function background(job: Promise<void>) {
  try {
    getCloudflareContext().ctx.waitUntil(job);
  } catch {
    void job;
  }
}

export function flowDeps(requestHost: string): FlowDeps | null {
  const db = cloudflareD1();
  if (!db) return null;
  const host = siteHostEnv() || requestHost;
  return {
    store: new SubStore(db),
    lib: { parseEmail, normalizeEmail, makeToken, verifyToken, hashesForAllKeys, hashForCurrentKey },
    ring: keyRing(),
    mailOn: mailEnv().MAIL_ENABLED === "1",
    nowSec: Math.floor(Date.now() / 1000),
    sendConfirm: async (to, lang, confirmToken) => background(send(to, buildConfirmMail({ lang, host, challengeId: currentChallengeId(), confirmToken }))),
    sendWelcome: async (to, lang, unsubToken) =>
      background(send(to, buildWelcomeMail({ lang, host, challengeId: currentChallengeId(), unsubToken }))),
  };
}

const esc = (s: string) => s.replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[c]!);

// Small HTML page. With `form`, renders a POST button carrying the token in the body (the confirm / unsubscribe GET
// pages): link scanners that pre-open mail links only GET, so they never change anything.
export function page(status: number, title: string, body: string, form?: { action: string; token: string; button: string }) {
  const f = form
    ? `<form method="post" action="${esc(form.action)}"><input type="hidden" name="token" value="${esc(form.token)}">` +
      `<button type="submit" style="font-size:1rem;padding:.6rem 1.2rem">${esc(form.button)}</button></form>`
    : "";
  const html =
    `<!doctype html><html lang="en"><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">` +
    `<meta name="robots" content="noindex"><title>${esc(title)}</title>` +
    `<body style="font-family:system-ui,sans-serif;max-width:32rem;margin:15vh auto;padding:0 1rem;text-align:center">` +
    `<h1>${esc(title)}</h1><p>${esc(body)}</p>${f}</body></html>`;
  return new Response(html, {
    status,
    headers: {
      "content-type": "text/html; charset=utf-8",
      "cache-control": "no-store",
      "referrer-policy": "no-referrer", // the token in the URL must not leak to other sites
      "x-frame-options": "DENY",
      "x-robots-tag": "noindex",
    },
  });
}

// Token from the query (one-click POST to the List-Unsubscribe URL, or GET) or from a form body (the button).
export async function tokenFrom(request: Request): Promise<string> {
  const q = new URL(request.url).searchParams.get("token");
  if (q) return q;
  try {
    const ct = request.headers.get("content-type") ?? "";
    if (ct.includes("application/x-www-form-urlencoded") || ct.includes("multipart/form-data")) {
      const t = (await request.formData()).get("token");
      return typeof t === "string" ? t : "";
    }
  } catch {
    /* unreadable body */
  }
  return "";
}
