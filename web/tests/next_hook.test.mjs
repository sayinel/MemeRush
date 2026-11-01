import { test } from "node:test";
import assert from "node:assert/strict";
import { normalizeFrom, nextTitleNo, hookSrc, hookMeta, HOOK_EVENT_CHALLENGE } from "../src/lib/next_hook.ts";
import { CLIENT_EVENTS, checkEventMeta } from "../src/lib/guard.ts";

test("next hook: title number follows from", () => {
  assert.equal(nextTitleNo(normalizeFrom("001")), "#002");
  assert.equal(nextTitleNo(normalizeFrom("002")), "#003");
  assert.equal(nextTitleNo(normalizeFrom(undefined)), "#002");
  assert.equal(nextTitleNo(normalizeFrom("zzz")), "#002");
});

test("next hook: src passes the subscribe route filter unchanged", () => {
  for (const f of ["001", "002"]) {
    const s = hookSrc(f);
    assert.equal(s.replace(/[^\w.-]/g, "").slice(0, 40), s);
  }
});

test("next hook: channel is appended and still passes the subscribe filter within 40 chars", () => {
  assert.equal(hookSrc("001", "sns_kr"), "hook_from_001.sns_kr");
  assert.equal(hookSrc("001", null), "hook_from_001");
  assert.equal(hookSrc("001", "a b/c!"), "hook_from_001.abc");
  const long = hookSrc("002", "x".repeat(60));
  assert.ok(long.length <= 40);
  assert.equal(long.replace(/[^\w.-]/g, "").slice(0, 40), long);
});

test("next hook: meta is only from+variant and within the guard", () => {
  const m = hookMeta("001");
  assert.deepEqual(Object.keys(m).sort(), ["from", "variant"]);
  assert.equal(checkEventMeta(m).ok, true);
  for (const t of ["next_banner_viewed", "next_banner_clicked", "hook_viewed", "hook_email_focus", "hook_email_submitted"]) assert.ok(CLIENT_EVENTS.has(t));
  assert.match(HOOK_EVENT_CHALLENGE, /^\d{4}-\d{2}-\d{2}$/);
});
