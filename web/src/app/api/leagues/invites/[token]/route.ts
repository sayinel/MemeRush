import { jsonError } from "@/lib/api";
import { supabaseAdmin } from "@/lib/supabase";

// Intro-screen info for a league invite link.
export async function GET(_request: Request, ctx: RouteContext<"/api/leagues/invites/[token]">) {
  const { token } = await ctx.params;
  const db = supabaseAdmin();
  const { data: league } = await db
    .from("leagues")
    .select("id, players(nickname)")
    .eq("invite_token", token)
    .maybeSingle();
  if (!league) return jsonError(404, "invite not found");
  const { count } = await db.from("league_members").select("player_id", { count: "exact", head: true }).eq("league_id", league.id);
  const owner = league.players as unknown as { nickname: string } | null;
  return Response.json({ leagueId: league.id, ownerNickname: owner?.nickname ?? "", memberCount: count ?? 0 });
}
