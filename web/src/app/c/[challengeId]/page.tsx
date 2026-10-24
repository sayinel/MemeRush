import { notFound } from "next/navigation";
import { getChallenge, listChallengeIds } from "@/lib/challenge";

export function generateStaticParams() {
  return listChallengeIds().map((challengeId) => ({ challengeId }));
}

export default async function ChallengePage({ params }: PageProps<"/c/[challengeId]">) {
  const { challengeId } = await params;
  const challenge = getChallenge(challengeId);
  if (!challenge) notFound();

  return (
    <main className="flex min-h-dvh flex-col items-center justify-center gap-6 bg-gradient-to-b from-sky-300 to-sky-500 p-6 text-center text-white">
      <p className="text-sm font-bold tracking-widest">MEMERUSH · DAILY #001</p>
      <h1 className="text-4xl font-black">{challenge.title}</h1>
      <p className="max-w-sm text-lg">{challenge.meme.prompt}</p>
      <ol className="space-y-1 text-sm">
        {challenge.meme.theme.rounds.map((r, i) => (
          <li key={r.label}>
            ROUND {i + 1}: {r.label} · {(challenge.frameParams.targetMs[i] / 1000).toFixed(2)}s
          </li>
        ))}
      </ol>
    </main>
  );
}
