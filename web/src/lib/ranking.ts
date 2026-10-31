import "server-only";
import { supabaseAdmin } from "./supabase";

export async function bestErrorMs(playerId: string, challengeId: string): Promise<number | null> {
  const { data } = await supabaseAdmin()
    .from("best_attempts")
    .select("error_ms")
    .eq("player_id", playerId)
    .eq("challenge_id", challengeId)
    .maybeSingle();
  return data?.error_ms ?? null;
}

// Competition ranking (1, 1, 3): players with a strictly lower best + 1.
export async function globalRank(challengeId: string, best: number): Promise<number> {
  const { count } = await supabaseAdmin()
    .from("best_attempts")
    .select("id", { count: "exact", head: true })
    .eq("challenge_id", challengeId)
    .lt("error_ms", best);
  return (count ?? 0) + 1;
}

// Top rows for the link-preview card: names are the public anonymous ones already shown on the ranking board.
export async function topRows(challengeId: string, n = 3): Promise<{ rank: number; nickname: string; errorMs: number }[]> {
  const { data } = await supabaseAdmin()
    .from("best_attempts")
    .select("nickname, error_ms")
    .eq("challenge_id", challengeId)
    .order("error_ms", { ascending: true })
    .order("finished_at", { ascending: true })
    .limit(n);
  let rank = 0;
  let prev: number | null = null;
  return (data ?? []).map((r, i) => {
    if (r.error_ms !== prev) rank = i + 1;
    prev = r.error_ms;
    return { rank, nickname: r.nickname as string, errorMs: r.error_ms as number };
  });
}

export async function playerCount(challengeId: string): Promise<number> {
  const { count } = await supabaseAdmin().from("best_attempts").select("id", { count: "exact", head: true }).eq("challenge_id", challengeId);
  return count ?? 0;
}

export async function leagueMemberIds(leagueId: string): Promise<string[]> {
  const { data } = await supabaseAdmin().from("league_members").select("player_id").eq("league_id", leagueId);
  return (data ?? []).map((r) => r.player_id as string);
}

export async function friendsRank(challengeId: string, leagueId: string, playerId: string, best: number): Promise<number | null> {
  const members = await leagueMemberIds(leagueId);
  if (!members.includes(playerId)) return null;
  const { count } = await supabaseAdmin()
    .from("best_attempts")
    .select("id", { count: "exact", head: true })
    .eq("challenge_id", challengeId)
    .in("player_id", members)
    .lt("error_ms", best);
  return (count ?? 0) + 1;
}
