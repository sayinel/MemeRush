import { readImageFile } from "@/app/admin/_lib/data";
import { guarded } from "@/app/admin/_lib/guard";

export const dynamic = "force-dynamic";

// out/pipeline/images 안의 이미지만 돌려준다(파일 이름은 허용 패턴만).
export async function GET(req: Request) {
  return guarded(null, async () => {
    const name = new URL(req.url).searchParams.get("name") ?? "";
    const img = await readImageFile(name);
    if (!img) return new Response(null, { status: 404 });
    return new Response(new Uint8Array(img.data), { headers: { "Content-Type": img.type, "Cache-Control": "no-store" } });
  });
}
