import "server-only";
import { bestErrorMs } from "./ranking";
import { supabaseAdmin } from "./supabase";

// The sharer's current best for the challenge the referral points at. Only the record leaves this function:
// no nickname, no league (AC-17).
export async function referralBest(ref: string): Promise<{ challengeId: string; errorMs: number } | null> {
  if (!/^[A-Za-z0-9_-]{1,32}$/.test(ref)) return null;
  const { data } = await supabaseAdmin().from("referrals").select("challenge_id, source_player_id").eq("id", ref).maybeSingle();
  if (!data) return null;
  const errorMs = await bestErrorMs(data.source_player_id, data.challenge_id);
  return errorMs === null ? null : { challengeId: data.challenge_id, errorMs };
}

export function formatOffSeconds(errorMs: number): string {
  return `${(errorMs / 1000).toFixed(3)}s`;
}
