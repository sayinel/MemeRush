import { AdminError, applyPick } from "@/app/admin/_lib/data";
import { guarded } from "@/app/admin/_lib/guard";
import { PICK_KINDS, type PickKind } from "@/app/admin/_lib/types";

export const dynamic = "force-dynamic";

// body: { kind: "topic" | "copy" | "image" | "date", value }. 허용 목록으로 검증한 뒤 pick 명령을 실행한다.
export async function POST(req: Request) {
  return guarded(req, async () => {
    const body = (await req.json().catch(() => null)) as { kind?: unknown; value?: unknown } | null;
    const kind = body?.kind;
    if (typeof kind !== "string" || !(PICK_KINDS as readonly string[]).includes(kind)) throw new AdminError("알 수 없는 선택이에요.");
    await applyPick(kind as PickKind, body?.value);
    return Response.json({ ok: true });
  });
}
