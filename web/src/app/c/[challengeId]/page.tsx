import { notFound } from "next/navigation";
import { getChallenge, listChallengeIds } from "@/lib/challenge";
import ChallengeClient from "./ChallengeClient";

export function generateStaticParams() {
  return listChallengeIds().map((challengeId) => ({ challengeId }));
}

export default async function ChallengePage({ params, searchParams }: PageProps<"/c/[challengeId]">) {
  const { challengeId } = await params;
  const challenge = getChallenge(challengeId);
  if (!challenge) notFound();
  const query = await searchParams;
  const ref = typeof query.ref === "string" ? query.ref : null;
  const league = typeof query.league === "string" ? query.league : null;
  return <ChallengeClient challenge={challenge} refId={ref} leagueToken={league} />;
}
