import { supabaseAdmin } from "@/lib/supabase";

// Deploy check: confirms env vars are set and the schema is reachable.
export async function GET() {
  try {
    const { error } = await supabaseAdmin().from("players").select("id", { count: "exact", head: true });
    if (error) return Response.json({ ok: false, db: error.message }, { status: 500 });
    return Response.json({ ok: true });
  } catch (e) {
    return Response.json({ ok: false, error: (e as Error).message }, { status: 500 });
  }
}
