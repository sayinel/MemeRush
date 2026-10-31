import { getChallenge } from "@/lib/challenge";
import { ogImage } from "@/lib/og";
import { formatOffSeconds, referralBest } from "@/lib/referral";
import { globalRank, playerCount, topRows } from "@/lib/ranking";
import type { OgRow } from "@/lib/og";

// Dynamic link preview for a share link: the sharer's best only (AC-17).
export async function GET(_request: Request, ctx: RouteContext<"/api/og/[ref]">) {
  const { ref } = await ctx.params;
  const best = await referralBest(ref);
  const challenge = best && getChallenge(best.challengeId);
  if (!best || !challenge) return new Response("not found", { status: 404 });
  // The sharer may still improve; crawlers fetch once, so a short shared cache is enough.
  // Ranking card: rank among all players plus a play CTA. Still no nickname or league (AC-17).
  const [rank, total, top] = await Promise.all([globalRank(best.challengeId, best.errorMs), playerCount(best.challengeId), topRows(best.challengeId, 3)]);
  // Top 3 plus the sharer's own row (name hidden, AC-17). Inside the top 3 the row is just marked instead of repeated.
  const rows: OgRow[] = top.map((t) => ({ rank: t.rank, name: t.nickname, time: formatOffSeconds(t.errorMs), me: t.errorMs === best.errorMs }));
  if (!rows.some((r) => r.me)) {
    if (rank > 4) rows.push({ rank: null, name: "", time: "" });
    rows.push({ rank, name: "Me", time: formatOffSeconds(best.errorMs), me: true });
  }
  return ogImage(
    { kicker: `#${rank} of ${total} players`, headline: `${formatOffSeconds(best.errorMs)} off`, sub: "Play now ▶ beat me", rows },
    { "Cache-Control": "public, s-maxage=300, stale-while-revalidate=3600" },
  );
}
