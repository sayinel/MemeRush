// Run: npm run test:mail  (node:test + node:sqlite as a stand-in for D1; migrations 0001 + 0002 are applied as written)
import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { DatabaseSync } from "node:sqlite";
import * as safety from "../src/lib/mail_safety.ts";
import * as tok from "../src/lib/sub_token.ts";
import { SubStore, subscribe, confirm, unsubscribe, suppressAddress, LIMITS } from "../src/lib/sub_flow.ts";
import { sendMail } from "../src/lib/mailer.ts";
import { buildConfirmMail, buildWelcomeMail } from "../src/lib/mail_templates.ts";

const RING = { current: "1", keys: { "1": "test-secret-one" } };
const LIB = { ...safety, ...tok };

function d1() {
  const db = new DatabaseSync(":memory:");
  for (const f of ["0001_init.sql", "0002_mail_hardening.sql"]) db.exec(readFileSync(new URL(`../d1/migrations/${f}`, import.meta.url), "utf8"));
  const norm = (v) => v.map((x) => (x === undefined ? null : x));
  return {
    raw: db,
    prepare(sql) {
      const st = db.prepare(sql);
      return {
        bind: (...v) => ({
          all: async () => ({ results: st.all(...norm(v)) }),
          first: async () => st.get(...norm(v)) ?? null,
        }),
      };
    },
  };
}

function deps(db, over = {}) {
  const sent = { confirm: [], welcome: [] };
  let n = 0;
  const d = {
    store: new SubStore(db),
    lib: LIB,
    ring: RING,
    mailOn: true,
    nowSec: 1_800_000_000,
    newId: () => `sub-${++n}`,
    sendConfirm: async (to, lang, token) => void sent.confirm.push({ to, lang, token }),
    sendWelcome: async (to, lang, token) => void sent.welcome.push({ to, lang, token }),
    ...over,
  };
  return { d, sent };
}
const req = (email, ip = "1.1.1.1") => ({ email, ip, lang: "en", source: null });

test("(1) double opt-in: pending + one confirm mail, active only after confirm, then welcome", async () => {
  const db = d1();
  const { d, sent } = deps(db);
  assert.deepEqual(await subscribe(d, req("A@Example.com")), { status: 200, action: "confirm_sent" });
  assert.equal(sent.confirm.length, 1);
  assert.equal(sent.welcome.length, 0);
  assert.equal(db.raw.prepare("select status from email_subscribers").get().status, "pending");
  // an unsubscribe token cannot confirm, a confirm token works once
  assert.equal(await confirm(d, (await tok.makeToken(RING, "u", "sub-1", d.nowSec + 99))), "invalid");
  assert.equal(await confirm(d, sent.confirm[0].token), "ok");
  assert.equal(db.raw.prepare("select status from email_subscribers").get().status, "active");
  assert.equal(sent.welcome.length, 1);
  assert.equal(await confirm(d, sent.confirm[0].token), "already");
  assert.equal(sent.welcome.length, 1);
});

test("(1) expired confirm token is refused; mail off or no key saves pending without mail", async () => {
  const db = d1();
  const { d, sent } = deps(db);
  await subscribe(d, req("b@example.com"));
  const later = { ...d, nowSec: d.nowSec + LIMITS.confirmTtlSec + 1 };
  assert.equal(await confirm(later, sent.confirm[0].token), "expired");
  for (const over of [{ mailOn: false }, { ring: null }]) {
    const x = deps(d1(), over);
    assert.deepEqual(await subscribe(x.d, req("c@example.com")), { status: 200, action: "saved_no_mail" });
    assert.equal(x.sent.confirm.length, 0);
  }
});

test("(2) rate limits: IP over 3 per minute, same inbox twice in the window", async () => {
  const db = d1();
  const { d, sent } = deps(db);
  for (let i = 0; i < 3; i++) assert.equal((await subscribe(d, req(`u${i}@example.com`, "9.9.9.9"))).status, 200);
  assert.deepEqual(await subscribe(d, req("u9@example.com", "9.9.9.9")), { status: 429, reason: "ip_limit" });
  assert.equal((await subscribe({ ...d, nowSec: d.nowSec + 61 }, req("u9@example.com", "9.9.9.9"))).status, 200); // new window
  assert.deepEqual(await subscribe(d, req("u0@example.com", "8.8.8.8")), { status: 429, reason: "address_limit" });
  assert.equal(sent.confirm.length, 4);
  // no clear IP or address in the counter table
  const keys = db.raw.prepare("select key from rate_limits").all().map((r) => r.key).join(" ");
  assert.doesNotMatch(keys, /9\.9\.9\.9|example/);
});

test("(2) +tag / case / Gmail-dot variants are one inbox: no second row, no second mail", async () => {
  assert.equal(safety.normalizeEmail("John.Doe+promo@GoogleMail.com"), "johndoe@gmail.com");
  assert.equal(safety.normalizeEmail("a.b+x@example.com"), "a.b@example.com");
  const db = d1();
  const { d, sent } = deps(db);
  await subscribe(d, req("john.doe@gmail.com", "1.0.0.1"));
  const later = { ...d, nowSec: d.nowSec + LIMITS.addressWindowSec + 1 };
  for (const [i, v] of ["JohnDoe+1@gmail.com", "j.o.h.n.doe+2@googlemail.com"].entries())
    assert.deepEqual(await subscribe({ ...later, nowSec: later.nowSec + i * 700 }, req(v, `2.0.0.${i}`)), { status: 200, action: "resend_later" });
  assert.equal(db.raw.prepare("select count(*) as n from email_subscribers").get().n, 1);
  assert.equal(sent.confirm.length, 1);
  // after a day one resend is allowed, to the address on the row
  const dayLater = { ...d, nowSec: d.nowSec + LIMITS.resendAfterSec + 1 };
  assert.equal((await subscribe(dayLater, req("johndoe+3@gmail.com", "3.0.0.1"))).action, "confirm_sent");
  assert.equal(sent.confirm[1].to, "john.doe@gmail.com");
});

test("(3)(4) unsubscribe deletes the row, suppresses the inbox, and re-subscribe sends nothing", async () => {
  const db = d1();
  const { d, sent } = deps(db);
  await subscribe(d, req("x@example.com"));
  await confirm(d, sent.confirm[0].token);
  const ut = sent.welcome[0].token;
  assert.match(ut, /^v1\.u\.sub-1\.[0-9]+\.[A-Za-z0-9_-]+$/);
  assert.equal(await unsubscribe(d, ut.slice(0, -2) + (ut.endsWith("AA") ? "BB" : "AA")), "invalid");
  assert.equal(await unsubscribe(d, ut), "ok");
  assert.equal(db.raw.prepare("select count(*) as n from email_subscribers").get().n, 0);
  const sup = db.raw.prepare("select hash, reason from email_suppressions").all();
  assert.equal(sup.length, 1);
  assert.equal(sup[0].reason, "unsubscribed");
  assert.doesNotMatch(sup[0].hash, /example/);
  assert.equal(await unsubscribe(d, ut), "already");
  const later = { ...d, nowSec: d.nowSec + 3600 };
  assert.deepEqual(await subscribe(later, req("X+again@Example.com", "4.4.4.4")), { status: 200, action: "suppressed" });
  assert.equal(sent.confirm.length, 1);
  assert.equal(db.raw.prepare("select count(*) as n from email_subscribers").get().n, 0);
});

test("(4) bounce suppression and key rotation keep blocking", async () => {
  const db = d1();
  const { d, sent } = deps(db);
  await suppressAddress(d, "bounce@example.com", "bounced");
  const rotated = { ...d, ring: { current: "2", keys: { "1": "test-secret-one", "2": "test-secret-two" } }, nowSec: d.nowSec + 9999 };
  assert.equal((await subscribe(rotated, req("bounce+z@example.com"))).action, "suppressed");
  assert.equal(sent.confirm.length, 0);
});

test("(3) token: no address inside, expiry and key version signed, old key still verifies, constant-time verify", async () => {
  const t = await tok.makeToken(RING, "u", "abc-123", 2000);
  assert.ok(!t.includes("@") && !t.toLowerCase().includes("example"));
  assert.deepEqual(await tok.verifyToken(RING, t, "u", 1000), { subId: "abc-123", exp: 2000 });
  assert.deepEqual(await tok.verifyToken(RING, t, "u", 2001), { expired: true });
  assert.equal(await tok.verifyToken(RING, t.replace(".2000.", ".9999."), "u", 1000), null); // extended expiry
  assert.equal(await tok.verifyToken(RING, t.replace("abc-123", "abc-124"), "u", 1000), null);
  assert.equal(await tok.verifyToken(RING, t, "c", 1000), null);
  assert.equal(await tok.verifyToken({ current: "1", keys: { "1": "other" } }, t, "u", 1000), null);
  assert.equal(await tok.verifyToken(null, t, "u", 1000), null);
  const ring2 = { current: "2", keys: { "1": "test-secret-one", "2": "k2" } };
  assert.ok((await tok.makeToken(ring2, "u", "abc-123", 2000)).startsWith("v2.u."));
  assert.deepEqual(await tok.verifyToken(ring2, t, "u", 1000), { subId: "abc-123", exp: 2000 });
  const src = readFileSync(new URL("../src/lib/sub_token.ts", import.meta.url), "utf8");
  assert.match(src, /crypto\.subtle\.verify\(/);
});

test("(3) welcome mail has RFC 8058 headers that reach the ACS body; confirm mail has the confirm link only", async () => {
  const w = buildWelcomeMail({ lang: "en", host: "x.example.com", challengeId: "c1", unsubToken: "v1.u.id.1.sig" });
  assert.equal(w.headers["List-Unsubscribe"], "<https://x.example.com/api/unsubscribe?token=v1.u.id.1.sig>");
  assert.equal(w.headers["List-Unsubscribe-Post"], "List-Unsubscribe=One-Click");
  let body;
  const fetchImpl = async (_u, init) => ((body = JSON.parse(init.body)), new Response(null, { status: 202 }));
  const env = { ACS_ENDPOINT: "https://r.communication.azure.com", ACS_ACCESS_KEY: "dGVzdA==", MAIL_ENABLED: "1" };
  await sendMail(env, { to: "a@example.com", ...w }, { fetchImpl });
  assert.equal(body.headers["List-Unsubscribe-Post"], "List-Unsubscribe=One-Click");
  for (const lang of ["ko", "en"]) {
    const c = buildConfirmMail({ lang, host: "x.example.com", challengeId: "2026-10-31", confirmToken: "v1.c.id.1.sig" });
    // first mail = today's game link (works before confirming) + "future news" confirm button
    assert.ok(c.text.includes("https://x.example.com/c/2026-10-31"));
    assert.ok(c.html.includes('href="https://x.example.com/c/2026-10-31"'));
    assert.ok(c.text.includes("https://x.example.com/api/subscribe/confirm?token=v1.c.id.1.sig"));
    assert.ok(!c.headers);
  }
  const ko = buildConfirmMail({ lang: "ko", host: "x.example.com", challengeId: "c", confirmToken: "t" });
  assert.match(ko.text, /새 게임 메일로 받기/);
  const evil = buildConfirmMail({ lang: "en", host: "evil.com/x?", challengeId: "c", confirmToken: "t" });
  assert.equal(evil.text.includes("evil.com"), false);
  assert.ok(evil.text.includes("https://memerush.superagents.run/c/c"));
});

test("(5) header injection: CR/LF addresses rejected, header values and subject cleaned", async () => {
  for (const bad of ["a@example.com\r\nBcc: v@evil.com", "a@example.com\n", "a @example.com", "a b@example.com", "<a@example.com>", "a@example"])
    assert.equal(safety.parseEmail(bad), null, JSON.stringify(bad));
  assert.equal(safety.parseEmail("  A.B+tag@Example.COM "), "a.b+tag@example.com");
  const db = d1();
  assert.deepEqual(await subscribe(deps(db).d, req("a@example.com\r\nBcc: v@evil.com")), { status: 400, reason: "invalid_email" });
  let calls = 0;
  let body;
  const fetchImpl = async (_u, init) => (calls++, (body = JSON.parse(init.body)), new Response(null, { status: 202 }));
  const env = { ACS_ENDPOINT: "https://r.communication.azure.com", ACS_ACCESS_KEY: "dGVzdA==", MAIL_ENABLED: "1" };
  const r = await sendMail(env, { to: "a@example.com\r\nBcc: v@evil.com", subject: "s", text: "t", html: "h" }, { fetchImpl });
  assert.deepEqual(r, { ok: false, reason: "invalid_recipient" });
  assert.equal(calls, 0);
  await sendMail(env, { to: "a@example.com", subject: "hi\r\nBcc: x", text: "t", html: "h", headers: { "X-A": "1\r\nBcc: x", "Bad Name": "v" } }, { fetchImpl });
  assert.equal(body.content.subject, "hiBcc: x");
  assert.deepEqual(body.headers, { "X-A": "1Bcc: x" });
});

test("(6) redactUrl hides token-like query values", () => {
  const out = safety.redactUrl("https://x.example.com/api/unsubscribe?token=v1.u.id.1.sig&lang=ko");
  assert.ok(!out.includes("v1.u.id"));
  assert.ok(out.includes("lang=ko"));
});
