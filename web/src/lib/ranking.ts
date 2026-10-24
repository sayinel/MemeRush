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
