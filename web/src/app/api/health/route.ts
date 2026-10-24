import { supabaseAdmin } from "@/lib/supabase";

// Deploy check: confirms env vars are set and the schema is reachable.
export async function GET() {
  try {
    // A real GET (not HEAD) so a wrong SUPABASE_URL path surfaces as an error.
    const { error } = await supabaseAdmin().from("players").select("id").limit(1);
    if (error) {
      // The project host is public (it ships in client apps elsewhere); it helps spot a mistyped SUPABASE_URL.
      const host = process.env.SUPABASE_URL ? new URL(process.env.SUPABASE_URL).host : null;
      return Response.json({ ok: false, db: error.message, details: error.details, hint: error.hint, host }, { status: 500 });
    }
    return Response.json({ ok: true });
  } catch (e) {
    return Response.json({ ok: false, error: (e as Error).message }, { status: 500 });
  }
}
