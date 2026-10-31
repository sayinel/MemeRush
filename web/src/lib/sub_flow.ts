// Subscription flow on Cloudflare D1: double opt-in, rate limits, suppression list, unsubscribe.
// Pure module: no runtime imports (helpers arrive in `lib`), so node:test can run it against node:sqlite.
// Never log addresses, tokens or IPs.
//
//   subscribe  -> row saved as 'pending', ONE confirmation mail (no further mail until confirmed)
//   confirm    -> POST with the confirm token, row becomes 'active', welcome mail (with one-click unsubscribe)
//   unsubscribe-> POST with the unsubscribe token, row deleted at once, keyed hash of the address kept on the
//                 suppression list so the address is never mailed again (also used for bounces)
import type * as Safety from "./mail_safety";
import type * as Tok from "./sub_token";

/* eslint-disable @typescript-eslint/no-explicit-any */
type Row = Record<string, any>;
export type D1Like = {
  prepare(sql: string): { bind(...v: unknown[]): { all(): Promise<{ results?: Row[] }>; first(): Promise<Row | null> } };
};
export type Lib = Pick<typeof Safety, "parseEmail" | "normalizeEmail"> &
  Pick<typeof Tok, "makeToken" | "verifyToken" | "hashesForAllKeys" | "hashForCurrentKey">;

export const LIMITS = {
  ipPerWindow: 3, // subscribe requests per IP
  ipWindowSec: 60,
  addressWindowSec: 600, // a second request for the same inbox within this window is refused
  resendAfterSec: 24 * 3600, // at most one confirmation mail per inbox per day
  confirmTtlSec: 48 * 3600,
  unsubTtlSec: 365 * 24 * 3600,
  pendingTtlSec: 7 * 24 * 3600, // unconfirmed rows are deleted after this
};

const iso = (sec: number) => new Date(sec * 1000).toISOString();

export class SubStore {
  private db: D1Like;
  constructor(db: D1Like) {
    this.db = db; // no parameter property: node's type stripping (tests) does not support it
  }

  // Fixed-window counter in one statement (one D1 row write). Returns the count inside the current window.
  async hit(key: string, windowSec: number, nowSec: number): Promise<number> {
    const cutoff = nowSec - windowSec;
    const r = await this.db
      .prepare(
        "insert into rate_limits (key, window_start, count) values (?, ?, 1) on conflict(key) do update set " +
          "count = case when rate_limits.window_start <= ? then 1 else rate_limits.count + 1 end, " +
          "window_start = case when rate_limits.window_start <= ? then ? else rate_limits.window_start end returning count",
      )
      .bind(key, nowSec, cutoff, cutoff, nowSec)
      .first();
    return Number(r?.count ?? 1);
  }
  async findByAddress(norm: string, email: string): Promise<Row | null> {
    return this.db
      .prepare("select id, email, lang, status, confirm_sent_at from email_subscribers where norm_email = ? or lower(email) = ? limit 1")
      .bind(norm, email)
      .first();
  }
  async insertPending(v: { id: string; email: string; norm: string; lang: string; source: string | null; nowSec: number; sent: boolean }): Promise<"ok" | "dup"> {
    try {
      await this.db
        .prepare(
          "insert into email_subscribers (id, email, norm_email, lang, source, status, created_at, confirm_sent_at) values (?, ?, ?, ?, ?, 'pending', ?, ?) returning id",
        )
        .bind(v.id, v.email, v.norm, v.lang, v.source, iso(v.nowSec), v.sent ? iso(v.nowSec) : null)
        .all();
      return "ok";
    } catch (e) {
      if (/UNIQUE constraint failed/i.test(String((e as Error)?.message))) return "dup";
      throw e;
    }
  }
  async markConfirmSent(id: string, nowSec: number) {
    await this.db.prepare("update email_subscribers set confirm_sent_at = ? where id = ? returning id").bind(iso(nowSec), id).all();
  }
  async getById(id: string): Promise<Row | null> {
    return this.db.prepare("select id, email, lang, status from email_subscribers where id = ?").bind(id).first();
  }
  async activate(id: string, nowSec: number): Promise<Row | null> {
    return this.db
      .prepare("update email_subscribers set status = 'active', confirmed_at = ? where id = ? and status = 'pending' returning id, email, lang")
      .bind(iso(nowSec), id)
      .first();
  }
  async deleteById(id: string): Promise<Row | null> {
    return this.db.prepare("delete from email_subscribers where id = ? returning email").bind(id).first();
  }
  async isSuppressed(hashes: string[]): Promise<boolean> {
    if (!hashes.length) return false;
    const r = await this.db
      .prepare(`select 1 as x from email_suppressions where hash in (${hashes.map(() => "?").join(",")}) limit 1`)
      .bind(...hashes)
      .first();
    return !!r;
  }
  async suppress(hash: string, reason: "unsubscribed" | "bounced" | "complained", nowSec: number) {
    await this.db
      .prepare("insert into email_suppressions (hash, reason, created_at) values (?, ?, ?) on conflict(hash) do nothing returning hash")
      .bind(hash, reason, iso(nowSec))
      .all();
  }
  // Housekeeping, called now and then from subscribe: expired pending rows and old rate-limit rows.
  async cleanup(nowSec: number) {
    await this.db.prepare("delete from email_subscribers where status = 'pending' and created_at < ? returning id").bind(iso(nowSec - LIMITS.pendingTtlSec)).all();
    await this.db.prepare("delete from rate_limits where window_start < ? returning key").bind(nowSec - 86400).all();
  }
}

export type FlowDeps = {
  store: SubStore;
  lib: Lib;
  ring: Tok.KeyRing | null; // null = secret not set: rows are still saved, no mail is sent
  mailOn: boolean; // MAIL_ENABLED === "1"
  nowSec: number;
  newId?: () => string;
  sendConfirm: (to: string, lang: string, confirmToken: string) => Promise<void>;
  sendWelcome: (to: string, lang: string, unsubToken: string) => Promise<void>;
};

export type SubscribeOutcome =
  | { status: 400; reason: "invalid_email" }
  | { status: 429; reason: "ip_limit" | "address_limit" }
  | { status: 200; action: "subscribed" | "confirm_sent" | "saved_no_mail" | "already" | "suppressed" | "resend_later" };

export async function subscribe(
  d: FlowDeps,
  input: { email: unknown; ip: string; lang: string; source: string | null },
): Promise<SubscribeOutcome> {
  const email = d.lib.parseEmail(input.email);
  if (!email) return { status: 400, reason: "invalid_email" };
  const norm = d.lib.normalizeEmail(email);

  const ipKey = `ip:${await d.lib.hashForCurrentKey(d.ring, "ip", input.ip || "unknown")}`;
  if ((await d.store.hit(ipKey, LIMITS.ipWindowSec, d.nowSec)) > LIMITS.ipPerWindow) return { status: 429, reason: "ip_limit" };
  const addrKey = `em:${await d.lib.hashForCurrentKey(d.ring, "em", norm)}`;
  if ((await d.store.hit(addrKey, LIMITS.addressWindowSec, d.nowSec)) > 1) return { status: 429, reason: "address_limit" };

  if (Math.random() < 0.02) await d.store.cleanup(d.nowSec).catch(() => undefined);

  // Unsubscribed or bounced before: answer like a success (does not reveal list membership), never mail again.
  if (await d.store.isSuppressed(await d.lib.hashesForAllKeys(d.ring, "sup", norm))) return { status: 200, action: "suppressed" };

  const canSend = d.mailOn && !!d.ring;
  const existing = await d.store.findByAddress(norm, email);
  if (existing) {
    if (existing.status === "active") return { status: 200, action: "already" };
    const last = existing.confirm_sent_at ? Date.parse(existing.confirm_sent_at) / 1000 : 0;
    if (!canSend) return { status: 200, action: "saved_no_mail" };
    if (d.nowSec - last < LIMITS.resendAfterSec) return { status: 200, action: "resend_later" };
    await d.store.markConfirmSent(existing.id, d.nowSec);
    // A row waiting from the old two-step flow becomes a single-step subscriber (사장님 F1031-8/9, 10/31): typing the
    // address again is the sign-up, so it is activated and gets the one mail with the unsubscribe link.
    // Goes to the address on the row (the first one typed), not to the variant in this request.
    await d.store.activate(existing.id, d.nowSec);
    await d.sendWelcome(existing.email, existing.lang, await d.lib.makeToken(d.ring!, "u", existing.id, d.nowSec + LIMITS.unsubTtlSec));
    return { status: 200, action: "subscribed" };
  }

  const id = (d.newId ?? (() => crypto.randomUUID()))();
  const r = await d.store.insertPending({ id, email, norm, lang: input.lang, source: input.source, nowSec: d.nowSec, sent: canSend });
  if (r === "dup") return { status: 200, action: "already" };
  if (!canSend) return { status: 200, action: "saved_no_mail" };
  // Single step (사장님 10/31, F1031-8): typing the address on the site is the sign-up, so there is no second button in
  // the mail. The row becomes active now and the one mail carries the game link and the unsubscribe link.
  await d.store.activate(id, d.nowSec);
  await d.sendWelcome(email, input.lang, await d.lib.makeToken(d.ring!, "u", id, d.nowSec + LIMITS.unsubTtlSec));
  return { status: 200, action: "subscribed" };
}

export type LinkOutcome = "ok" | "already" | "invalid" | "expired" | "gone";

export async function confirm(d: FlowDeps, token: string): Promise<LinkOutcome> {
  const v = await d.lib.verifyToken(d.ring, token, "c", d.nowSec);
  if (!v) return "invalid";
  if ("expired" in v) return "expired";
  const row = await d.store.activate(v.subId, d.nowSec);
  if (!row) {
    const cur = await d.store.getById(v.subId);
    return cur?.status === "active" ? "already" : "gone";
  }
  if (d.mailOn && d.ring) await d.sendWelcome(row.email, row.lang, await d.lib.makeToken(d.ring, "u", v.subId, d.nowSec + LIMITS.unsubTtlSec));
  return "ok";
}

export async function unsubscribe(d: FlowDeps, token: string): Promise<LinkOutcome> {
  const v = await d.lib.verifyToken(d.ring, token, "u", d.nowSec);
  if (!v) return "invalid";
  if ("expired" in v) return "expired";
  const row = await d.store.deleteById(v.subId);
  if (!row) return "already"; // already deleted: still a success for the user
  await d.store.suppress(await d.lib.hashForCurrentKey(d.ring, "sup", d.lib.normalizeEmail(row.email)), "unsubscribed", d.nowSec);
  return "ok";
}

// For a bounce or complaint report (not wired yet: needs the ACS delivery-report webhook).
export async function suppressAddress(d: Pick<FlowDeps, "store" | "lib" | "ring" | "nowSec">, email: string, reason: "bounced" | "complained") {
  const norm = d.lib.normalizeEmail(email);
  await d.store.suppress(await d.lib.hashForCurrentKey(d.ring, "sup", norm), reason, d.nowSec);
  const row = await d.store.findByAddress(norm, email.trim().toLowerCase());
  if (row) await d.store.deleteById(row.id);
}
