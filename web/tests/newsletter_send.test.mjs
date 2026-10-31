import test from "node:test";
import assert from "node:assert/strict";
import { runNewsletter, validateJob, MAX_TEST } from "../src/lib/newsletter_send.ts";

const base = { issueNo: "#001", dateLabel: "10.31 토", videoUrl: "https://youtu.be/yKmsuhAaghg" };

function makeDeps(over = {}) {
  const sent = [];
  const claimed = new Set();
  const deps = {
    host: "memerush.superagents.run",
    challengeId: "toast-cam-001",
    replyAddress: "memerush@superagents.run",
    nowSec: 1000,
    parseEmail: (v) => (typeof v === "string" && /^[^\s@]+@[^\s@]+$/.test(v) ? v.trim() : null),
    normalizeEmail: (e) => e.toLowerCase(),
    findByAddress: async () => null,
    listActive: async () => [],
    isSuppressedAddress: async () => false,
    unsubToken: async (id) => "tok-" + id,
    claim: async (k) => (claimed.has(k) ? false : (claimed.add(k), true)),
    release: async (k) => void claimed.delete(k),
    send: async (to, mail) => (sent.push({ to, mail }), { ok: true }),
    ...over,
  };
  return { deps, sent, claimed };
}

test("validateJob: needs exactly one of test / all, and the confirm phrase for all", () => {
  assert.equal(validateJob({ ...base }).ok, false);
  assert.equal(validateJob({ ...base, test: ["a@simplifier.co.kr"], all: true }).ok, false);
  assert.equal(validateJob({ ...base, all: true }).ok, false);
  assert.equal(validateJob({ ...base, all: true, confirm: "SEND #002" }).ok, false);
  assert.equal(validateJob({ ...base, all: true, confirm: "SEND #001" }).ok, true);
  assert.equal(validateJob({ ...base, test: ["a@simplifier.co.kr"] }).ok, true);
});

test("validateJob: rejects bad issue, label, video host and oversize test list", () => {
  assert.equal(validateJob({ ...base, issueNo: "1", test: ["a@simplifier.co.kr"] }).ok, false);
  assert.equal(validateJob({ ...base, videoUrl: "https://evil.example/x", test: ["a@simplifier.co.kr"] }).ok, false);
  assert.equal(validateJob({ ...base, dateLabel: "<b>", test: ["a@simplifier.co.kr"] }).ok, false);
  assert.equal(validateJob({ ...base, test: Array(MAX_TEST + 1).fill("a@simplifier.co.kr") }).ok, false);
});

test("test mode sends only to @simplifier.co.kr and counts the rest as invalid", async () => {
  const { deps, sent } = makeDeps();
  const r = await runNewsletter(deps, { ...base, test: ["fit@simplifier.co.kr", "outsider@gmail.com", "not-an-email"] });
  assert.equal(r.mode, "test");
  assert.equal(r.sent, 1);
  assert.equal(r.skippedInvalid, 2);
  assert.deepEqual(sent.map((s) => s.to), ["fit@simplifier.co.kr"]);
});

test("mail carries one-click unsubscribe headers, vote links and the play link", async () => {
  const { deps, sent } = makeDeps({ findByAddress: async () => ({ id: "sub1", email: "fit@simplifier.co.kr", lang: "ko" }) });
  await runNewsletter(deps, { ...base, test: ["fit@simplifier.co.kr"] });
  const m = sent[0].mail;
  assert.match(m.headers["List-Unsubscribe"], /\/api\/unsubscribe\?token=tok-sub1>/);
  assert.equal(m.headers["List-Unsubscribe-Post"], "List-Unsubscribe=One-Click");
  assert.match(m.html, /\/vote\?c=dalgona&amp;s=sub1/);
  assert.match(m.html, /\/c\/toast-cam-001/);
  assert.match(m.subject, /^밈레터 #001/);
});

test("all mode: skips suppressed, sends once per issue, retries only failures", async () => {
  const rows = [
    { id: "s1", email: "a@x.com", lang: "ko" },
    { id: "s2", email: "b@x.com", lang: "ko" },
    { id: "s3", email: "c@x.com", lang: "ko" },
  ];
  let failB = true;
  const got = [];
  const { deps } = makeDeps({
    listActive: async () => rows,
    isSuppressedAddress: async (n) => n === "c@x.com",
    send: async (to, mail) => {
      if (to === "b@x.com" && failB) return { ok: false, reason: "http_5xx" };
      got.push(to);
      return { ok: true };
    },
  });
  const r1 = await runNewsletter(deps, { ...base, all: true });
  assert.deepEqual([r1.sent, r1.failed, r1.skippedSuppressed, r1.skippedAlready], [1, 1, 1, 0]);
  assert.deepEqual(r1.failReasons, { http_5xx: 1 });
  failB = false;
  const r2 = await runNewsletter(deps, { ...base, all: true });
  assert.deepEqual([r2.sent, r2.failed, r2.skippedSuppressed, r2.skippedAlready], [1, 0, 1, 1]);
  assert.deepEqual(got.sort(), ["a@x.com", "b@x.com"]);
});

test("report never contains an address", async () => {
  const { deps } = makeDeps({ listActive: async () => [{ id: "s1", email: "a@x.com", lang: "ko" }] });
  const r = await runNewsletter(deps, { ...base, all: true });
  assert.ok(!JSON.stringify(r).includes("@"));
});
