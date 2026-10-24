import { AdminError, applyRun } from "@/app/admin/_lib/data";
import { guarded } from "@/app/admin/_lib/guard";
import { RUN_MODES, type RunMode } from "@/app/admin/_lib/types";

export const dynamic = "force-dynamic";

// body: { mode?: "resume" | "new" | "reimage" }. pipeline --resume 을 백그라운드로 실행한다.
export async function POST(req: Request) {
  return guarded(req, async () => {
    const body = (await req.json().catch(() => ({}))) as { mode?: unknown };
    const mode = body.mode ?? "resume";
    if (typeof mode !== "string" || !(RUN_MODES as readonly string[]).includes(mode)) throw new AdminError("알 수 없는 실행이에요.");
    const r = await applyRun(mode as RunMode);
    return Response.json({ ok: true, ...r });
  });
}
