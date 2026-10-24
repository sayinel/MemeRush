import { jsonError, readJson } from "@/lib/api";
import { currentPlayer, logEvent } from "@/lib/session";
import { supabaseAdmin } from "@/lib/supabase";

// Explicit join (the "Join & Play" button). Joining twice is a no-op.
export async function POST(request: Request) {
  const player = await currentPlayer();
  if (!player) return jsonError(401, "no session");
  const body = await readJson(request);
  const inviteToken = typeof body?.inviteToken === "string" ? body.inviteToken : "";
  const db = supabaseAdmin();
  const { data: league } = await db.from("leagues").select("id").eq("invite_token", inviteToken).maybeSingle();
  if (!league) return jsonError(404, "invite not found");

  const { error } = await db
    .from("league_members")
    .upsert({ league_id: league.id, player_id: player.id }, { onConflict: "league_id,player_id", ignoreDuplicates: true });
  if (error) return jsonError(500, error.message);
  await logEvent("league_joined", { playerId: player.id, meta: { leagueId: league.id } });
  return Response.json({ leagueId: league.id });
}
