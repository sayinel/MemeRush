// Newsletter ("밈레터") sender core. Pure module (all I/O comes in through `deps`) so node tests can import it directly.
// Two modes:
//   test: a few internal addresses (@simplifier.co.kr only), no per-issue de-duplication. Used to measure a send end to end.
//   all:  every ACTIVE subscriber, once per issue (claim row in rate_limits before sending), suppressed addresses skipped.
// Never returns or logs an address: only counts and reasons.

import { renderNewsletter } from "./mail/newsletter.ts";

export const TEST_DOMAIN = "@simplifier.co.kr";
export const MAX_TEST = 5;
export const MAX_ALL = 40; // one request stays well under the Worker subrequest limit; larger lists go out in several calls
const CLAIM_WINDOW_SEC = 10 * 365 * 24 * 3600;

export type SubRow = { id: string; email: string; lang: string };

export type SendDeps = {
  host: string;
  challengeId: string;
  replyAddress: string;
  nowSec: number;
  parseEmail: (v: unknown) => string | null;
  normalizeEmail: (e: string) => string;
  findByAddress: (norm: string, email: string) => Promise<SubRow | null>;
  listActive: (limit: number) => Promise<SubRow[]>;
  isSuppressedAddress: (norm: string) => Promise<boolean>;
  unsubToken: (subId: string) => Promise<string>;
  claim: (key: string, nowSec: number, windowSec: number) => Promise<boolean>; // true = first claim for this key
  release: (key: string) => Promise<void>;
  send: (to: string, mail: { subject: string; text: string; html: string; headers: Record<string, string> }) => Promise<{ ok: true } | { ok: false; reason: string }>;
};

export type Job = { issueNo: string; dateLabel: string; videoUrl: string; test?: string[]; all?: boolean };

export type Report = {
  mode: "test" | "all";
  sent: number;
  skippedSuppressed: number;
  skippedAlready: number;
  skippedInvalid: number;
  failed: number;
  failReasons: Record<string, number>;
};

const ISSUE_OK = /^#\d{1,4}$/;
const LABEL_OK = /^[\w .:·가-힣-]{1,20}$/;
const VIDEO_OK = /^https:\/\/(youtu\.be|www\.youtube\.com)\/[\w\-?=&%./]{1,120}$/;

export function validateJob(j: unknown): { ok: true; job: Job } | { ok: false; error: string } {
  const o = (j ?? {}) as Record<string, unknown>;
  if (typeof o.issueNo !== "string" || !ISSUE_OK.test(o.issueNo)) return { ok: false, error: "invalid issueNo" };
  if (typeof o.dateLabel !== "string" || !LABEL_OK.test(o.dateLabel)) return { ok: false, error: "invalid dateLabel" };
  if (typeof o.videoUrl !== "string" || !VIDEO_OK.test(o.videoUrl)) return { ok: false, error: "invalid videoUrl" };
  const test = o.test;
  const all = o.all === true;
  if (all === (test !== undefined)) return { ok: false, error: "choose exactly one of test / all" };
  if (all && o.confirm !== `SEND ${o.issueNo}`) return { ok: false, error: "confirm phrase missing" };
  if (test !== undefined) {
    if (!Array.isArray(test) || test.length < 1 || test.length > MAX_TEST || test.some((t) => typeof t !== "string")) return { ok: false, error: "invalid test list" };
  }
  return { ok: true, job: { issueNo: o.issueNo, dateLabel: o.dateLabel, videoUrl: o.videoUrl, test: test as string[] | undefined, all } };
}

function emptyReport(mode: "test" | "all"): Report {
  return { mode, sent: 0, skippedSuppressed: 0, skippedAlready: 0, skippedInvalid: 0, failed: 0, failReasons: {} };
}

async function sendOne(d: SendDeps, job: Job, to: string, subId: string, r: Report): Promise<void> {
  const base = `https://${d.host}`;
  const unsubUrl = `${base}/api/unsubscribe?token=${encodeURIComponent(await d.unsubToken(subId))}`;
  const nl = renderNewsletter({
    issueNo: job.issueNo,
    dateLabel: job.dateLabel,
    playUrl: `${base}/c/${encodeURIComponent(d.challengeId)}`,
    unsubUrl,
    replyAddress: d.replyAddress,
    videoUrl: job.videoUrl,
    voteBaseUrl: `${base}/vote`,
    subscriberRef: subId === "test" ? undefined : subId,
  });
  const res = await d.send(to, {
    subject: nl.subject,
    text: nl.text,
    html: nl.html,
    headers: { "List-Unsubscribe": `<${unsubUrl}>`, "List-Unsubscribe-Post": "List-Unsubscribe=One-Click" },
  });
  if (res.ok) r.sent++;
  else {
    r.failed++;
    r.failReasons[res.reason] = (r.failReasons[res.reason] ?? 0) + 1;
  }
}

export async function runNewsletter(d: SendDeps, job: Job): Promise<Report> {
  if (job.all) {
    const r = emptyReport("all");
    const rows = await d.listActive(MAX_ALL);
    for (const row of rows) {
      const email = d.parseEmail(row.email);
      if (!email) {
        r.skippedInvalid++;
        continue;
      }
      if (await d.isSuppressedAddress(d.normalizeEmail(email))) {
        r.skippedSuppressed++;
        continue;
      }
      const key = `nl:${job.issueNo}:${row.id}`;
      if (!(await d.claim(key, d.nowSec, CLAIM_WINDOW_SEC))) {
        r.skippedAlready++;
        continue;
      }
      const before = r.failed;
      await sendOne(d, job, email, row.id, r);
      if (r.failed > before) await d.release(key); // a failed send can be retried by calling again
    }
    return r;
  }
  const r = emptyReport("test");
  for (const raw of job.test ?? []) {
    const email = d.parseEmail(raw);
    if (!email || !email.toLowerCase().endsWith(TEST_DOMAIN)) {
      r.skippedInvalid++;
      continue;
    }
    const row = await d.findByAddress(d.normalizeEmail(email), email.toLowerCase());
    await sendOne(d, job, email, row?.id ?? "test", r);
  }
  return r;
}
