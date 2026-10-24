import { randomBytes } from "node:crypto";
import { jsonError, readJson } from "@/lib/api";
import { getChallenge } from "@/lib/challenge";
import { bestErrorMs } from "@/lib/ranking";
import { currentPlayer, newToken } from "@/lib/session";
import { supabaseAdmin } from "@/lib/supabase";

// Share link. invite=true also creates (once) the player's league and adds its invite token.
export async function POST(request: Request) {
  const player = await currentPlayer();
  if (!player) return jsonError(401, "no session");
  const body = await readJson(request);
  const challengeId = typeof body?.challengeId === "string" ? body.challengeId : "";
  if (!getChallenge(challengeId)) return jsonError(404, "unknown challenge");
  if ((await bestErrorMs(player.id, challengeId)) === null) return jsonError(403, "finish a game first");

  const db = supabaseAdmin();
  let league: { id: string; invite_token: string } | null = null;
  if (body?.invite === true) {
    const { data: existing } = await db.from("leagues").select("id, invite_token").eq("owner_id", player.id).maybeSingle();
    league = existing;
    if (!league) {
      const { data: created, error } = await db
        .from("leagues")
        .insert({ owner_id: player.id, invite_token: newToken() })
        .select("id, invite_token")
        .single();
      if (error) return jsonError(500, error.message);
      league = created;
      await db.from("league_members").insert({ league_id: league.id, player_id: player.id });
    }
  }

  const referralId = randomBytes(9).toString("base64url");
  const { error } = await db.from("referrals").insert({
    id: referralId,
    challenge_id: challengeId,
    source_player_id: player.id,
    league_id: league?.id ?? null,
  });
  if (error) return jsonError(500, error.message);

  const url = new URL(`/c/${challengeId}`, new URL(request.url).origin);
  url.searchParams.set("ref", referralId);
  if (league) url.searchParams.set("league", league.invite_token);
  return Response.json({ url: url.toString(), referralId, leagueId: league?.id ?? null });
}
