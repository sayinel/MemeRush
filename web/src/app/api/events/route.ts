import { jsonError, readJson } from "@/lib/api";
import { getChallenge } from "@/lib/challenge";
import { CLIENT_EVENTS, EVENT_BODY_MAX_BYTES, checkEventMeta } from "@/lib/guard";
import { currentPlayer, logEvent } from "@/lib/session";
import { supabaseAdmin } from "@/lib/supabase";

// Client-side events (MVP_SCOPE 8절). Server-side ones are logged by their own routes.
// Unauthenticated, so the body and meta are size-capped (lib/guard.ts) to keep D1 writes and storage bounded.
export async function POST(request: Request) {
  const declared = Number(request.headers.get("content-length") ?? "0");
  if (declared > EVENT_BODY_MAX_BYTES) return jsonError(413, "body too large");
  const body = await readJson(request);
  const type = typeof body?.type === "string" ? body.type : "";
  const challengeId = typeof body?.challengeId === "string" ? body.challengeId : "";
  if (!CLIENT_EVENTS.has(type)) return jsonError(400, "unknown event");
  if (!getChallenge(challengeId)) return jsonError(404, "unknown challenge");
  const metaCheck = checkEventMeta(body?.meta);
  if (!metaCheck.ok) return jsonError(metaCheck.status, metaCheck.error);

  let referralId: string | null = null;
  if (typeof body?.ref === "string" && body.ref && body.ref.length <= 64) {
    const { data } = await supabaseAdmin().from("referrals").select("id").eq("id", body.ref).maybeSingle();
    referralId = data?.id ?? null;
  }
  const player = await currentPlayer();
  await logEvent(type, { challengeId, playerId: player?.id ?? null, referralId, meta: metaCheck.meta });
  return new Response(null, { status: 204 });
}
