import "server-only";
import { randomBytes } from "node:crypto";
import { cookies } from "next/headers";
import { supabaseAdmin } from "./supabase";

const COOKIE = "mr_sid";
const ONE_YEAR_S = 60 * 60 * 24 * 365;

export type Player = { id: string; nickname: string };

export function newToken(): string {
  return randomBytes(16).toString("base64url");
}

// Player for the mr_sid cookie, or null. The player id never leaves the server (MVP_SCOPE 5절).
export async function currentPlayer(): Promise<Player | null> {
  const token = (await cookies()).get(COOKIE)?.value;
  if (!token) return null;
  const { data } = await supabaseAdmin().from("players").select("id, nickname").eq("session_token", token).maybeSingle();
  return data ?? null;
}

export async function setSessionCookie(token: string) {
  (await cookies()).set(COOKIE, token, {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    path: "/",
    maxAge: ONE_YEAR_S,
  });
}

export async function logEvent(
  type: string,
  fields: { challengeId?: string; playerId?: string | null; referralId?: string | null; meta?: Record<string, unknown> } = {},
) {
  await supabaseAdmin().from("events").insert({
    type,
    challenge_id: fields.challengeId ?? null,
    player_id: fields.playerId ?? null,
    referral_id: fields.referralId ?? null,
    meta: fields.meta ?? null,
  });
}
