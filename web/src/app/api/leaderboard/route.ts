import { jsonError } from "@/lib/api";
import { getChallenge } from "@/lib/challenge";
import { supabaseAdmin } from "@/lib/supabase";

// Global top 50. Same response for everyone, so the CDN may cache it for 5 s.
const TOP_N = 10;

export async function GET(request: Request) {
  const challengeId = new URL(request.url).searchParams.get("challengeId") ?? "";
  if (!getChallenge(challengeId)) return jsonError(404, "unknown challenge");

  const { data, error } = await supabaseAdmin()
    .from("best_attempts")
    .select("nickname, error_ms, finished_at")
    .eq("challenge_id", challengeId)
    .order("error_ms", { ascending: true })
    .order("finished_at", { ascending: true })
    .limit(TOP_N); // top list only; the client appends the player's own row when outside it (사장님 10/30)
  if (error) return jsonError(500, error.message);

  let rank = 0;
  let prev: number | null = null;
  const rows = (data ?? []).map((r, i) => {
    if (r.error_ms !== prev) rank = i + 1;
    prev = r.error_ms;
    return { nickname: r.nickname, errorMs: r.error_ms, rank };
  });
  return Response.json({ rows }, { headers: { "Cache-Control": "public, s-maxage=5" } });
}
