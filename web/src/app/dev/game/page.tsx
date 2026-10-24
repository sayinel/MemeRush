import { connection } from "next/server";
import { currentChallengeId, getChallenge } from "@/lib/challenge";
import DevGame from "./DevGame";

// Throwaway dev harness for the game scene without the backend. /dev/game?day=YYYY-MM-DD picks a day file.
export default async function DevGamePage({ searchParams }: PageProps<"/dev/game">) {
  await connection();
  const { day } = await searchParams;
  const challenge = getChallenge(typeof day === "string" ? day : currentChallengeId()) ?? getChallenge(currentChallengeId())!;
  return <DevGame challenge={challenge} />;
}
