import { readState } from "@/app/admin/_lib/data";
import { guarded } from "@/app/admin/_lib/guard";

export const dynamic = "force-dynamic";

// 개발 환경 전용(ADMIN_LOCAL=1). 파이프라인 파일을 읽어 화면 상태를 돌려준다.
export async function GET() {
  return guarded(null, async () => Response.json(await readState(), { headers: { "Cache-Control": "no-store" } }));
}
