import { getChallenge } from "@/lib/challenge";
import { ogImage } from "@/lib/og";
import { formatOffSeconds, referralBest } from "@/lib/referral";

// Dynamic link preview for a share link: the sharer's best only (AC-17).
export async function GET(_request: Request, ctx: RouteContext<"/api/og/[ref]">) {
  const { ref } = await ctx.params;
  const best = await referralBest(ref);
  const challenge = best && getChallenge(best.challengeId);
  if (!best || !challenge) return new Response("not found", { status: 404 });
  // The sharer may still improve; crawlers fetch once, so a short shared cache is enough.
  return ogImage(
    { kicker: challenge.title, headline: `${formatOffSeconds(best.errorMs)} off`, sub: "Can you beat me?" },
    { "Cache-Control": "public, s-maxage=300, stale-while-revalidate=3600" },
  );
}
