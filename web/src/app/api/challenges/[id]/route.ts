import { jsonError } from "@/lib/api";
import { getChallenge } from "@/lib/challenge";

export async function GET(_request: Request, ctx: RouteContext<"/api/challenges/[id]">) {
  const { id } = await ctx.params;
  const challenge = getChallenge(id);
  if (!challenge) return jsonError(404, "unknown challenge");
  const { context, ...meme } = challenge.meme; // research notes stay server-side
  void context;
  return Response.json({ ...challenge, meme });
}
