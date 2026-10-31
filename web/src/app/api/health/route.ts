import { supabaseAdmin } from "@/lib/supabase";

// Deploy check: confirms the database binding/keys work. Public and unauthenticated, so the response is only
// { ok }; the database message (with SUPABASE_URL host, details, hint) goes to the server log only.
export async function GET() {
  try {
    // A real GET (not HEAD) so a wrong SUPABASE_URL path surfaces as an error.
    const { error } = await supabaseAdmin().from("players").select("id").limit(1);
    if (error) {
      const host = process.env.SUPABASE_URL ? new URL(process.env.SUPABASE_URL).host : null;
      console.error("[api] health:", error.message, error.details ?? "", error.hint ?? "", host ?? "");
      return Response.json({ ok: false }, { status: 500 });
    }
    return Response.json({ ok: true });
  } catch (e) {
    console.error("[api] health:", (e as Error).message);
    return Response.json({ ok: false }, { status: 500 });
  }
}
