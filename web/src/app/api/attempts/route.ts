import { jsonError, readJson } from "@/lib/api";
import { getChallenge } from "@/lib/challenge";
import { currentPlayer, logEvent } from "@/lib/session";
import { supabaseAdmin } from "@/lib/supabase";

// Start an attempt; started_at comes from the DB clock.
export async function POST(request: Request) {
  const player = await currentPlayer();
  if (!player) return jsonError(401, "no session");
  const body = await readJson(request);
  const challengeId = typeof body?.challengeId === "string" ? body.challengeId : "";
  if (!getChallenge(challengeId)) return jsonError(404, "unknown challenge");

  let referralId: string | null = null;
  if (typeof body?.ref === "string" && body.ref) {
    const { data } = await supabaseAdmin()
      .from("referrals")
      .select("id")
      .eq("id", body.ref)
      .eq("challenge_id", challengeId)
      .maybeSingle();
    referralId = data?.id ?? null; // unknown refs are ignored
  }

  const { data, error } = await supabaseAdmin()
    .from("attempts")
    .insert({ player_id: player.id, challenge_id: challengeId, referral_id: referralId })
    .select("id")
    .single();
  if (error) return jsonError(500, error.message);

  await logEvent("game_started", { challengeId, playerId: player.id, referralId });
  return Response.json({ attemptId: data.id });
}
