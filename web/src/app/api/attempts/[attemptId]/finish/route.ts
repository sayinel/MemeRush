import { jsonError, readJson } from "@/lib/api";
import { getChallenge } from "@/lib/challenge";
import { bestErrorMs, friendsRank, globalRank } from "@/lib/ranking";
import { currentPlayer, logEvent } from "@/lib/session";
import { supabaseAdmin } from "@/lib/supabase";
import { scoreRounds, validateRounds } from "@/lib/timing";

export async function POST(request: Request, ctx: RouteContext<"/api/attempts/[attemptId]/finish">) {
  const { attemptId } = await ctx.params;
  const player = await currentPlayer();
  if (!player) return jsonError(401, "no session");
  const body = await readJson(request);

  const db = supabaseAdmin();
  const { data: attempt } = await db
    .from("attempts")
    .select("id, player_id, challenge_id, referral_id, finished_at")
    .eq("id", attemptId)
    .maybeSingle();
  if (!attempt || attempt.player_id !== player.id) return jsonError(404, "attempt not found");
  if (attempt.finished_at) return jsonError(409, "attempt already finished");
  const challenge = getChallenge(attempt.challenge_id);
  if (!challenge) return jsonError(404, "unknown challenge");

  const { data: serverElapsedMs, error: rpcError } = await db.rpc("attempt_server_elapsed_ms", { p_attempt: attemptId });
  if (rpcError || typeof serverElapsedMs !== "number") return jsonError(500, rpcError?.message ?? "elapsed unavailable");

  const invalid = validateRounds(challenge, body?.roundElapsedMs, serverElapsedMs);
  if (invalid) return jsonError(422, invalid);
  const roundElapsedMs = body!.roundElapsedMs as number[];
  const result = scoreRounds(challenge, roundElapsedMs);

  const previousBest = await bestErrorMs(player.id, challenge.id);
  const { data: updated, error } = await db
    .from("attempts")
    .update({
      finished_at: new Date().toISOString(),
      round_elapsed_ms: roundElapsedMs,
      round_error_ms: result.roundErrorsMs,
      error_ms: result.errorMs,
      outcome: result.outcome,
      outcome_variant: result.outcomeVariant,
    })
    .eq("id", attemptId)
    .is("finished_at", null) // guards against a concurrent double finish
    .select("id");
  if (error) return jsonError(500, error.message);
  if (!updated?.length) return jsonError(409, "attempt already finished");

  const best = previousBest === null ? result.errorMs : Math.min(previousBest, result.errorMs);
  const leagueId = typeof body?.leagueId === "string" ? body.leagueId : null;
  const [gRank, fRank] = await Promise.all([
    globalRank(challenge.id, best),
    leagueId ? friendsRank(challenge.id, leagueId, player.id, best) : Promise.resolve(null),
  ]);

  await logEvent("game_completed", {
    challengeId: challenge.id,
    playerId: player.id,
    referralId: attempt.referral_id,
    meta: { errorMs: result.errorMs, outcome: result.outcome },
  });

  return Response.json({
    ...result,
    bestErrorMs: best,
    isNewBest: previousBest === null || result.errorMs < previousBest,
    globalRank: gRank,
    friendsRank: fRank,
  });
}
