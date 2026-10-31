import { jsonError, serverError } from "@/lib/api";
import { getChallenge } from "@/lib/challenge";
import { supabaseAdmin } from "@/lib/supabase";

// Global top 10. Same response for everyone, so it is cached for a few seconds.
const TOP_N = 10;
/**
 * Seconds a leaderboard response is reused. Workers responses are not put in the CDN cache by Cache-Control alone,
 * so the route uses the Workers Cache API (caches.default) itself: within this window repeated requests in the same
 * Cloudflare location skip the best_attempts scan (a D1 read of every finished attempt of the day).
 */
const LEADERBOARD_TTL_S = 5;

type EdgeCache = { match(key: Request): Promise<Response | undefined>; put(key: Request, res: Response): Promise<void> };

function edgeCache(): EdgeCache | null {
  // Present on Cloudflare Workers only; next dev/start on the PC has no `caches.default` and skips caching.
  const c = (globalThis as { caches?: { default?: EdgeCache } }).caches?.default;
  return c ?? null;
}

export async function GET(request: Request) {
  const url = new URL(request.url);
  const challengeId = url.searchParams.get("challengeId") ?? "";
  if (!getChallenge(challengeId)) return jsonError(404, "unknown challenge");

  // Cache key built only from the validated challenge id, so extra query strings cannot bypass the cache.
  const cache = edgeCache();
  const key = new Request(`${url.origin}/api/leaderboard?challengeId=${encodeURIComponent(challengeId)}`, { method: "GET" });
  if (cache) {
    try {
      const hit = await cache.match(key);
      if (hit) return hit;
    } catch (e) {
      console.error("[api] leaderboard cache read:", (e as Error).message);
    }
  }

  const { data, error } = await supabaseAdmin()
    .from("best_attempts")
    .select("nickname, error_ms, finished_at")
    .eq("challenge_id", challengeId)
    .order("error_ms", { ascending: true })
    .order("finished_at", { ascending: true })
    .limit(TOP_N); // top list only; the client appends the player's own row when outside it (사장님 10/30)
  if (error) return serverError("leaderboard", error);

  let rank = 0;
  let prev: number | null = null;
  const rows = (data ?? []).map((r, i) => {
    if (r.error_ms !== prev) rank = i + 1;
    prev = r.error_ms;
    return { nickname: r.nickname, errorMs: r.error_ms, rank };
  });
  const res = Response.json({ rows }, { headers: { "Cache-Control": `public, max-age=${LEADERBOARD_TTL_S}, s-maxage=${LEADERBOARD_TTL_S}` } });
  if (cache) {
    try {
      await cache.put(key, res.clone());
    } catch (e) {
      console.error("[api] leaderboard cache write:", (e as Error).message);
    }
  }
  return res;
}
