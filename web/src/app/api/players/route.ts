import { jsonError, readJson, serverError } from "@/lib/api";
import { checkNickname } from "@/lib/guard";
import { currentPlayer, newToken, setSessionCookie } from "@/lib/session";
import { supabaseAdmin } from "@/lib/supabase";

// Register a nickname and issue the mr_sid cookie; with a cookie, only the nickname changes.
export async function POST(request: Request) {
  const body = await readJson(request);
  // Server-side check (lib/guard.ts): NFKC, invisible/bidi characters removed, 1-20 characters, small block list.
  const checked = checkNickname(body?.nickname);
  if (!checked.ok) return jsonError(400, checked.error);
  const nickname = checked.nickname;

  const existing = await currentPlayer();
  if (existing) {
    const { error } = await supabaseAdmin().from("players").update({ nickname }).eq("id", existing.id);
    if (error) return serverError("players", error);
    return Response.json({ nickname });
  }

  const token = newToken();
  const { error } = await supabaseAdmin().from("players").insert({ session_token: token, nickname });
  if (error) return serverError("players", error);
  await setSessionCookie(token);
  return Response.json({ nickname });
}
