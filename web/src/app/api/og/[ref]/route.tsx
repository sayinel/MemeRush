import { getChallenge } from "@/lib/challenge";
import { ogImage } from "@/lib/og";
import { formatOffSeconds, referralBest } from "@/lib/referral";
import { globalRank, playerCount } from "@/lib/ranking";

// Dynamic link preview for a share link: the sharer's best only (AC-17).
export async function GET(_request: Request, ctx: RouteContext<"/api/og/[ref]">) {
  const { ref } = await ctx.params;
  const best = await referralBest(ref);
  const challenge = best && getChallenge(best.challengeId);
  if (!best || !challenge) return new Response("not found", { status: 404 });
  // The sharer may still improve; crawlers fetch once, so a short shared cache is enough.
  // Ranking card: rank among all players plus a play CTA. Still no nickname or league (AC-17).
  const [rank, total] = await Promise.all([globalRank(best.challengeId, best.errorMs), playerCount(best.challengeId)]);
  return ogImage(
    { kicker: `#${rank} of ${total} players`, headline: `${formatOffSeconds(best.errorMs)} off`, sub: "Play now ▶ beat me" },
    { "Cache-Control": "public, s-maxage=300, stale-while-revalidate=3600" },
  );
}
