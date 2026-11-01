// Security guard tests (run: npm test). Node 22.6+/24 loads the .ts module by stripping types.
import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync, readdirSync, statSync } from "node:fs";
import { join } from "node:path";
import { checkEventMeta, checkNickname, CLIENT_EVENTS, EVENT_META_MAX_BYTES } from "../src/lib/guard.ts";

const read = (p) => readFileSync(new URL(`../${p}`, import.meta.url), "utf8");

// (1) /api/events
test("events: only the known client event types are accepted", () => {
  assert.deepEqual([...CLIENT_EVENTS].sort(), ["challenge_link_copied", "challenge_link_opened", "hook_email_focus", "hook_email_submitted", "hook_viewed", "native_share_invoked", "next_banner_clicked", "next_banner_viewed", "video_downloaded"]);
  assert.equal(CLIENT_EVENTS.has("attempt_finished"), false);
});

test("events: meta up to 2KB is kept, larger is 413", () => {
  assert.deepEqual(checkEventMeta({ src: "kakao" }), { ok: true, meta: { src: "kakao" } });
  assert.deepEqual(checkEventMeta(undefined), { ok: true, meta: undefined });
  assert.deepEqual(checkEventMeta("text"), { ok: true, meta: undefined }); // non-objects are dropped as before
  assert.deepEqual(checkEventMeta([1, 2]), { ok: true, meta: undefined });
  const big = { blob: "x".repeat(EVENT_META_MAX_BYTES) };
  const r = checkEventMeta(big);
  assert.equal(r.ok, false);
  assert.equal(r.status, 413);
  // multi-byte characters are counted in UTF-8 bytes
  assert.equal(checkEventMeta({ s: "가".repeat(700) }).ok, false);
});

test("events route checks body size and meta before writing", () => {
  const src = read("src/app/api/events/route.ts");
  assert.match(src, /content-length/);
  assert.match(src, /checkEventMeta\(body\?\.meta\)/);
  assert.ok(src.indexOf("checkEventMeta") < src.indexOf("logEvent(type"), "meta is checked before logEvent");
});

// (2) nicknames
test("nickname: normal names pass, auto names always pass", () => {
  assert.deepEqual(checkNickname("Player-AB12"), { ok: true, nickname: "Player-AB12" });
  assert.deepEqual(checkNickname("Player-5H1T"), { ok: true, nickname: "Player-5H1T" });
  assert.deepEqual(checkNickname("  김밈러  "), { ok: true, nickname: "김밈러" });
  assert.deepEqual(checkNickname("Ａｌｉｃｅ"), { ok: true, nickname: "Alice" }); // NFKC
});

test("nickname: bidi, zero-width and control characters are removed", () => {
  assert.deepEqual(checkNickname("ab\u202Ecd"), { ok: true, nickname: "abcd" });
  assert.deepEqual(checkNickname("a\u200Bb\u200Dc\uFEFF"), { ok: true, nickname: "abc" });
  assert.deepEqual(checkNickname("a\u0000b\nc"), { ok: true, nickname: "abc" });
  assert.equal(checkNickname("\u200B\u200B").ok, false); // nothing left
  assert.equal(checkNickname("\u3164").ok, false); // Hangul filler only
  assert.equal(checkNickname("---").ok, false); // no letter or digit
});

test("nickname: length is 1-20 characters after cleaning", () => {
  assert.equal(checkNickname("").ok, false);
  assert.equal(checkNickname(42).ok, false);
  assert.equal(checkNickname("a".repeat(20)).ok, true);
  assert.equal(checkNickname("a".repeat(21)).ok, false);
  assert.equal(checkNickname("a".repeat(20) + "\u200B\u200B").ok, true);
});

test("nickname: impersonation and profanity are refused", () => {
  for (const n of ["admin", "Admin123", "A.d.m.1.n", "MemeRush Official", "운영자", "관리자님", "fuck you", "f.u.c.k", "씨발", "병 신"]) {
    assert.equal(checkNickname(n).ok, false, n);
  }
});

test("players route uses the shared nickname check", () => {
  assert.match(read("src/app/api/players/route.ts"), /checkNickname\(body\?\.nickname\)/);
});

// (3) leaderboard cache
test("leaderboard caches with caches.default and a normalized key", () => {
  const src = read("src/app/api/leaderboard/route.ts");
  assert.match(src, /caches\?\.default/);
  assert.match(src, /cache\.match\(key\)/);
  assert.match(src, /cache\.put\(key/);
  assert.match(src, /api\/leaderboard\?challengeId=\$\{encodeURIComponent\(challengeId\)\}/);
});

// (4) no raw DB errors in responses
function walk(dir) {
  return readdirSync(dir).flatMap((f) => {
    const p = join(dir, f);
    return statSync(p).isDirectory() ? walk(p) : [p];
  });
}
test("API routes never return error.message to the client", () => {
  const api = new URL("../src/app/api", import.meta.url);
  for (const f of walk(api.pathname.replace(/^\/([A-Za-z]:)/, "$1"))) {
    if (!/route\.tsx?$/.test(f)) continue;
    const src = readFileSync(f, "utf8");
    assert.doesNotMatch(src, /jsonError\(500,[^)]*message/, f);
    assert.doesNotMatch(src, /Response\.json\([^)]*\.message/, f);
  }
  const health = read("src/app/api/health/route.ts");
  assert.doesNotMatch(health, /details: |hint: |host }/);
});

// (5) dev/mock/sfx notes out of the public build, QA hook dev-only
test("cf-build excludes dev pages, mock pages and sfx notes", () => {
  const src = read("scripts/cf-build.mjs");
  for (const p of ["src/app/dev", "public/mock", "public/sfx/README.md", "public/sfx/SOURCES.md", "src/app/admin", "src/app/api/admin", "src/app/api/videos"]) {
    assert.ok(src.includes(`"${p}"`), p);
  }
});

test("window.__mrRound is set in development builds only", () => {
  const src = read("src/game/TimingStopScene.ts");
  const at = src.indexOf("__mrRound =");
  const guard = src.lastIndexOf('process.env.NODE_ENV !== "production"', at);
  assert.ok(at > 0 && guard > 0 && at - guard < 200);
});

// (6) wrangler
test("wrangler: workers.dev and preview URLs are off", () => {
  const src = read("wrangler.jsonc");
  assert.match(src, /"workers_dev":\s*false/);
  assert.match(src, /"preview_urls":\s*false/);
});

// (7) headers
test("security headers in next.config and public/_headers", async () => {
  const { SECURITY_HEADERS } = await import("../next.config.ts");
  const keys = SECURITY_HEADERS.map((h) => h.key);
  assert.deepEqual(keys, ["X-Content-Type-Options", "Referrer-Policy", "Content-Security-Policy"]);
  assert.match(SECURITY_HEADERS[2].value, /frame-ancestors 'self'/);
  const assets = read("public/_headers");
  for (const h of SECURITY_HEADERS) assert.ok(assets.includes(`${h.key}: ${h.value}`), h.key);
});
