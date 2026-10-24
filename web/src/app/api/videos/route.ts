import { jsonError, readJson } from "@/lib/api";
import { getChallenge } from "@/lib/challenge";
import { globalRank } from "@/lib/ranking";
import { renderVideo } from "@/lib/render";
import { currentPlayer, logEvent } from "@/lib/session";
import { supabaseAdmin } from "@/lib/supabase";
import { resultScenes } from "@/lib/video";

export const maxDuration = 60;

const BUCKET = "videos";

// Result video for the player's best attempt (MVP_SCOPE 5절 API, 7절). Synchronous: render → upload → URL.
// Reuses the stored file when that best attempt already has one; a new best gets a new video.
export async function POST(request: Request) {
  const player = await currentPlayer();
  if (!player) return jsonError(401, "no session");
  const body = await readJson(request);
  const challengeId = typeof body?.challengeId === "string" ? body.challengeId : "";
  const challenge = getChallenge(challengeId);
  if (!challenge) return jsonError(404, "unknown challenge");

  const db = supabaseAdmin();
  const { data: best, error } = await db
    .from("best_attempts")
    .select("id, error_ms, round_elapsed_ms, outcome, outcome_variant, video_path")
    .eq("player_id", player.id)
    .eq("challenge_id", challengeId)
    .maybeSingle();
  if (error) return jsonError(500, error.message);
  if (!best) return jsonError(403, "finish a game first");

  let videoPath: string = best.video_path ?? "";
  if (!videoPath) {
    const started = Date.now();
    const rank = await globalRank(challengeId, best.error_ms);
    const origin = new URL(request.url);
    const publicUrl = `${origin.host}/c/${challengeId}`;
    let mp4: Buffer;
    try {
      mp4 = await renderVideo(
        resultScenes(
          challenge,
          {
            outcome: best.outcome,
            outcomeVariant: best.outcome_variant,
            roundElapsedMs: best.round_elapsed_ms,
            errorMs: best.error_ms,
          },
          rank,
          publicUrl,
        ),
      );
    } catch (e) {
      // The record is already saved (AC-20); the client falls back to the result card.
      return jsonError(500, `render failed: ${(e as Error).message}`);
    }
    videoPath = `${challengeId}/${best.id}.mp4`;
    const up = await db.storage.from(BUCKET).upload(videoPath, mp4, { contentType: "video/mp4", upsert: true });
    if (up.error) return jsonError(500, up.error.message);
    const { error: saveError } = await db.from("attempts").update({ video_path: videoPath }).eq("id", best.id);
    if (saveError) return jsonError(500, saveError.message);
    await logEvent("video_generated", {
      challengeId,
      playerId: player.id,
      meta: {
        attemptId: best.id,
        renderMs: Date.now() - started,
        bytes: mp4.length,
      },
    });
  }

  const storage = db.storage.from(BUCKET);
  return Response.json({
    url: storage.getPublicUrl(videoPath).data.publicUrl,
    downloadUrl: storage.getPublicUrl(videoPath, {
      download: `meme-rush-${challengeId}.mp4`,
    }).data.publicUrl,
    type: "video/mp4",
  });
}
