// Run: npm test  (node:test with Node's built-in TypeScript stripping)
import test from "node:test";
import assert from "node:assert/strict";
import { renderNewsletter } from "../src/lib/mail/newsletter.ts";

const BASE = {
  issueNo: "#001",
  dateLabel: "10.31 토",
  playUrl: "https://memerush.superagents.run/c/2026-10-25?from=mail",
  unsubUrl: "https://memerush.superagents.run/api/unsubscribe?token=t",
  replyAddress: "memerush@superagents.run",
  videoUrl: "https://youtu.be/yKmsuhAaghg",
  voteBaseUrl: "https://memerush.superagents.run/vote",
};

test("required text, 3 vote links, bulletproof button, images", () => {
  const r = renderNewsletter({ ...BASE, subscriberRef: "a b&1", lastResult: { offLabel: "2.086s off", rank: 5 } });
  assert.equal(r.subject, "밈레터 #001 다음 게임 투표, 오늘 30초만 하고 가세요");
  for (const k of ["dalgona", "ufo", "fishing"]) assert.ok(r.html.includes(`vote?c=${k}&amp;s=a%20b%261`), k);
  assert.ok(r.html.includes('bgcolor="#FF6A2B"') && r.html.includes("height:56px"));
  assert.ok(r.html.includes("https://memerush.superagents.run/mail/banner.jpg"));
  assert.ok(r.html.includes("https://memerush.superagents.run/mail/video-thumb.jpg"));
  assert.ok(r.html.includes('alt="Meme Rush 배너'));
  assert.ok(r.html.includes("문의는 memerush@superagents.run 로 보내 주세요") && r.html.includes("수신취소"));
  assert.ok(r.html.includes("word-break:keep-all") && r.html.includes('width="600"'));
  assert.ok(r.html.includes("퇴근까지 5초. 버튼 누를 준비 됐죠?"));
  assert.ok(r.text.includes("vote?c=ufo&s=a%20b%261") && r.text.includes("2.086s off"));
});

test("vote link without subscriberRef has no s param", () => {
  const r = renderNewsletter(BASE);
  assert.ok(r.html.includes("vote?c=ufo\"") && !r.html.includes("&amp;s="));
});

test("no lastResult means no 내 기록 section", () => {
  const r = renderNewsletter(BASE);
  assert.ok(!r.html.includes("내 기록") && !r.text.includes("내 기록"));
});

test("subject has no (광고) prefix", () => {
  assert.ok(!renderNewsletter(BASE).subject.includes("(광고)"));
});

test("user-controlled values are HTML-escaped", () => {
  const r = renderNewsletter({ ...BASE, lastResult: { offLabel: '<img src=x onerror=alert(1)>"', rank: 1 } });
  assert.ok(!r.html.includes("<img src=x"));
  assert.ok(r.html.includes("&lt;img src=x onerror=alert(1)&gt;&quot;"));
});

test("inline styles only, no <style> block, no font below 12px", () => {
  const { html } = renderNewsletter({ ...BASE, lastResult: { offLabel: "1s off", rank: 2 } });
  assert.ok(!/<style[\s>]/i.test(html));
  for (const m of html.matchAll(/font-size:(\d+(?:\.\d+)?)px/g)) assert.ok(Number(m[1]) >= 12, m[0]);
});
