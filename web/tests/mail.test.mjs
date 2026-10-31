// Run: npm run test:mail  (node:test with Node's built-in TypeScript stripping; no extra dependency)
import test from "node:test";
import assert from "node:assert/strict";
import { signAcs, sendMail, sha256B64 } from "../src/lib/mailer.ts";
import { buildWelcomeMail } from "../src/lib/mail_templates.ts";

const KEY = "dGVzdC1rZXktMDEyMzQ1Njc4OQ=="; // fake key for tests: base64("test-key-0123456789")
const ENV = { ACS_ENDPOINT: "https://r.communication.azure.com", ACS_ACCESS_KEY: KEY, MAIL_ENABLED: "1" };
const MSG = { to: "a@example.com", subject: "s", text: "t", html: "<p>t</p>" };

test("signature matches a value computed independently (python hmac)", async () => {
  assert.equal(await sha256B64('{"a":1}'), "AVq9f1zFei3ZS3WQ8ErYCEJzkF7jPsXOvq5iJ2qX+GI=");
  const sig = await signAcs({
    method: "POST",
    pathAndQuery: "/emails:send?api-version=2023-03-31",
    date: "Sat, 31 Oct 2026 00:00:00 GMT",
    host: "r.communication.azure.com",
    contentHash: "AVq9f1zFei3ZS3WQ8ErYCEJzkF7jPsXOvq5iJ2qX+GI=",
    accessKey: KEY,
  });
  assert.equal(sig, "6OT9M6E8AvfOhzBqDxTu2oPiH8zuP/96BYY/C3PsQRM=");
});

test("202 is success and the request is shaped as expected", async () => {
  let seen;
  const fetchImpl = async (url, init) => {
    seen = { url, init };
    return new Response(null, { status: 202, headers: { "operation-id": "op1" } });
  };
  const r = await sendMail(ENV, MSG, { now: new Date("2026-10-31T00:00:00Z"), fetchImpl });
  assert.deepEqual(r, { ok: true, operationId: "op1" });
  assert.equal(seen.url, "https://r.communication.azure.com/emails:send?api-version=2023-03-31");
  assert.match(seen.init.headers.authorization, /^HMAC-SHA256 SignedHeaders=x-ms-date;host;x-ms-content-sha256&Signature=.+/);
  assert.equal(seen.init.headers["x-ms-content-sha256"], await sha256B64(seen.init.body));
  assert.equal(JSON.parse(seen.init.body).senderAddress, "memerush@superagents.run");
});

test("4xx and network errors are failures with a reason only", async () => {
  const r4 = await sendMail(ENV, MSG, { fetchImpl: async () => new Response("secret body", { status: 401 }) });
  assert.deepEqual(r4, { ok: false, reason: "http_4xx" });
  const r5 = await sendMail(ENV, MSG, { fetchImpl: async () => new Response(null, { status: 503 }) });
  assert.deepEqual(r5, { ok: false, reason: "http_5xx" });
  const rn = await sendMail(ENV, MSG, {
    fetchImpl: async () => {
      throw new Error("boom");
    },
  });
  assert.deepEqual(rn, { ok: false, reason: "network" });
});

test("MAIL_ENABLED off (or not exactly 1) never calls fetch", async () => {
  let called = 0;
  const fetchImpl = async () => {
    called++;
    return new Response(null, { status: 202 });
  };
  for (const v of [undefined, "", "0", "true"]) {
    const r = await sendMail({ ...ENV, MAIL_ENABLED: v }, MSG, { fetchImpl });
    assert.deepEqual(r, { ok: false, reason: "disabled" });
  }
  assert.equal(called, 0);
});

test("template switches language, defaults to en, has game and unsubscribe links, no daily promise", () => {
  const base = { host: "x.example.com", challengeId: "2026-10-25", unsubToken: "abc.def" };
  const ko = buildWelcomeMail({ ...base, lang: "ko" });
  const en = buildWelcomeMail({ ...base, lang: "en" });
  const other = buildWelcomeMail({ ...base, lang: "fr" });
  assert.match(ko.subject, /[가-힣]/);
  assert.doesNotMatch(en.subject, /[가-힣]/);
  assert.deepEqual(other, en);
  for (const m of [ko, en]) {
    assert.ok(m.text.includes("https://x.example.com/c/2026-10-25"));
    assert.ok(m.text.includes("https://x.example.com/api/unsubscribe?token=abc.def"));
    assert.ok(m.html.includes("/api/unsubscribe?token=abc.def"));
  }
  assert.doesNotMatch(ko.text + en.text, /매일|every day|daily|tomorrow|내일/i);
});
