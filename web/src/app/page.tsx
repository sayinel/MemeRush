import { redirect } from "next/navigation";
import { connection } from "next/server";
import { currentChallengeId } from "@/lib/challenge";

export default async function Home() {
  // Pick today's challenge per request, not at build time.
  await connection();
  redirect(`/c/${currentChallengeId()}`);
}
