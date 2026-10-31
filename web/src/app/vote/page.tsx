import type { Metadata } from "next";
import { VOTE_CHOICES } from "@/lib/mail/newsletter";
import { currentChallengeId } from "@/lib/challenge";
import VoteClient from "./VoteClient";

// Mail links open this page with GET ?c=<key>&s=<ref>. GET never records a vote (mail security scanners
// pre-open links); the button inside VoteClient sends POST /api/vote.
export const metadata: Metadata = { title: "다음 게임 투표", robots: { index: false, follow: false } };
export const dynamic = "force-dynamic";

export default async function VotePage({ searchParams }: { searchParams: Promise<{ c?: string; s?: string }> }) {
  const { c, s } = await searchParams;
  const choice = VOTE_CHOICES.find((x) => x.key === c) ?? null;
  const refId = typeof s === "string" && /^[A-Za-z0-9_.:-]{1,64}$/.test(s) ? s : "";
  return (
    <VoteClient
      choice={choice ? { key: choice.key, label: choice.label } : null}
      choices={VOTE_CHOICES.map((x) => ({ key: x.key, label: x.label }))}
      refId={refId}
      todayUrl={`/c/${currentChallengeId()}`}
    />
  );
}
