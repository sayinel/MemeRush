import { jsonError } from "@/lib/api";
import { getChallenge } from "@/lib/challenge";
import { leagueMemberIds } from "@/lib/ranking";
import { currentPlayer } from "@/lib/session";
import { supabaseAdmin } from "@/lib/supabase";

// Friends ranking: members only, members with a record today only.
export async function GET(request: Request, ctx: RouteContext<"/api/leagues/[leagueId]/leaderboard">) {
  const { leagueId } = await ctx.params;
  const challengeId = new URL(request.url).searchParams.get("challengeId") ?? "";
  if (!getChallenge(challengeId)) return jsonError(404, "unknown challenge");
  const player = await currentPlayer();
  if (!player) return jsonError(401, "no session");
  const members = await leagueMemberIds(leagueId);
  if (!members.includes(player.id)) return jsonError(403, "not a member");

  const { data, error } = await supabaseAdmin()
    .from("best_attempts")
    .select("player_id, nickname, error_ms, finished_at")
    .eq("challenge_id", challengeId)
    .in("player_id", members)
    .order("error_ms", { ascending: true })
    .order("finished_at", { ascending: true });
  if (error) return jsonError(500, error.message);

  let rank = 0;
  let prev: number | null = null;
  const rows = (data ?? []).map((r, i) => {
    if (r.error_ms !== prev) rank = i + 1;
    prev = r.error_ms;
    return { nickname: r.nickname as string, errorMs: r.error_ms as number, rank, isMe: r.player_id === player.id };
  });
  const me = rows.find((r) => r.isMe) ?? null;
  // Gap to #1, or (when I'm #1) my lead over #2.
  let gapMs: number | null = null;
  if (me && rows.length > 1) gapMs = me.rank === 1 ? rows.find((r) => !r.isMe)!.errorMs - me.errorMs : me.errorMs - rows[0].errorMs;
  return Response.json({ rows, myRank: me?.rank ?? null, gapMs });
}
