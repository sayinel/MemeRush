import { getChallenge } from "@/lib/challenge";
import { bestErrorMs, globalRank } from "@/lib/ranking";
import { currentPlayer } from "@/lib/session";
import { supabaseAdmin } from "@/lib/supabase";

// Returning-visit state: who am I, my best today, and my leagues.
export async function GET(request: Request) {
  const challengeId = new URL(request.url).searchParams.get("challengeId") ?? "";
  const player = await currentPlayer();
  if (!player) return Response.json({ leagues: [] });

  const best = getChallenge(challengeId) ? await bestErrorMs(player.id, challengeId) : null;
  const { data: memberships } = await supabaseAdmin()
    .from("league_members")
    .select("league_id, leagues(owner_id, players(nickname))")
    .eq("player_id", player.id);

  const leagues = (memberships ?? []).map((m) => {
    const league = m.leagues as unknown as { owner_id: string; players: { nickname: string } | null } | null;
    return {
      leagueId: m.league_id as string,
      ownerNickname: league?.players?.nickname ?? "",
      isOwner: league?.owner_id === player.id,
    };
  });

  return Response.json({
    nickname: player.nickname,
    bestErrorMs: best,
    globalRank: best === null ? null : await globalRank(challengeId, best),
    leagues,
  });
}
