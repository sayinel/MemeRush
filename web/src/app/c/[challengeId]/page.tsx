import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { dailyNo, getChallenge, listChallengeIds } from "@/lib/challenge";
import { formatOffSeconds, referralBest } from "@/lib/referral";
import ChallengeClient from "./ChallengeClient";

export function generateStaticParams() {
  return listChallengeIds().map((challengeId) => ({ challengeId }));
}

// Link preview (MVP_SCOPE 6절): a valid ref shows the sharer's best; never reads `league` (AC-17).
// Relative URLs resolve against metadataBase in the root layout, so crawlers get absolute ones.
export async function generateMetadata({ params, searchParams }: PageProps<"/c/[challengeId]">): Promise<Metadata> {
  const { challengeId } = await params;
  const challenge = getChallenge(challengeId);
  if (!challenge) return {};
  const { ref } = await searchParams;
  const best = typeof ref === "string" ? await referralBest(ref) : null;
  const shared = best?.challengeId === challengeId ? best : null;
  // WRITING_GUIDE 6절: "Meme Rush #001: …"
  const title = `Meme Rush ${dailyNo(challengeId)}: ${challenge.title}`;
  const description = shared
    ? `I was ${formatOffSeconds(shared.errorMs)} off. Can you beat me?`
    : `${challenge.frameParams.rounds} rounds. Stop the clock. Can you beat it?`;
  const image = { url: shared ? `/api/og/${ref}` : "/og-default.png", width: 1200, height: 630, alt: title };
  return {
    title,
    description,
    openGraph: { type: "website", siteName: "Meme Rush", title, description, images: [image] },
    twitter: { card: "summary_large_image", title, description, images: [image.url] },
  };
}

export default async function ChallengePage({ params, searchParams }: PageProps<"/c/[challengeId]">) {
  const { challengeId } = await params;
  const challenge = getChallenge(challengeId);
  if (!challenge) notFound();
  const query = await searchParams;
  const ref = typeof query.ref === "string" ? query.ref : null;
  const league = typeof query.league === "string" ? query.league : null;
  return <ChallengeClient challenge={challenge} dailyNo={dailyNo(challengeId)} refId={ref} leagueToken={league} />;
}
