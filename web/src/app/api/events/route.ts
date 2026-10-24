import { jsonError, readJson } from "@/lib/api";
import { getChallenge } from "@/lib/challenge";
import { currentPlayer, logEvent } from "@/lib/session";
import { supabaseAdmin } from "@/lib/supabase";

// Client-side events (MVP_SCOPE 8절). Server-side ones are logged by their own routes.
const CLIENT_EVENTS = new Set(["challenge_link_opened", "video_downloaded", "native_share_invoked", "challenge_link_copied"]);

export async function POST(request: Request) {
  const body = await readJson(request);
  const type = typeof body?.type === "string" ? body.type : "";
  const challengeId = typeof body?.challengeId === "string" ? body.challengeId : "";
  if (!CLIENT_EVENTS.has(type)) return jsonError(400, "unknown event");
  if (!getChallenge(challengeId)) return jsonError(404, "unknown challenge");

  let referralId: string | null = null;
  if (typeof body?.ref === "string" && body.ref) {
    const { data } = await supabaseAdmin().from("referrals").select("id").eq("id", body.ref).maybeSingle();
    referralId = data?.id ?? null;
  }
  const meta = body?.meta && typeof body.meta === "object" ? (body.meta as Record<string, unknown>) : undefined;
  const player = await currentPlayer();
  await logEvent(type, { challengeId, playerId: player?.id ?? null, referralId, meta });
  return new Response(null, { status: 204 });
}
