import { jsonError, readJson } from "@/lib/api";
import { currentPlayer, newToken, setSessionCookie } from "@/lib/session";
import { supabaseAdmin } from "@/lib/supabase";

// Register a nickname and issue the mr_sid cookie; with a cookie, only the nickname changes.
export async function POST(request: Request) {
  const body = await readJson(request);
  const nickname = typeof body?.nickname === "string" ? body.nickname.trim() : "";
  if (nickname.length < 1 || nickname.length > 20) return jsonError(400, "nickname must be 1-20 characters");

  const existing = await currentPlayer();
  if (existing) {
    const { error } = await supabaseAdmin().from("players").update({ nickname }).eq("id", existing.id);
    if (error) return jsonError(500, error.message);
    return Response.json({ nickname });
  }

  const token = newToken();
  const { error } = await supabaseAdmin().from("players").insert({ session_token: token, nickname });
  if (error) return jsonError(500, error.message);
  await setSessionCookie(token);
  return Response.json({ nickname });
}
