import { AdminError, adminEnabled } from "./data";

export const notFound = () => new Response(null, { status: 404 });

/** 같은 주소에서 온 요청만 받는다(다른 사이트가 로컬 명령을 누르지 못하게). */
export function sameOrigin(req: Request): boolean {
  const origin = req.headers.get("origin");
  if (!origin) return true;
  try {
    return new URL(origin).host === req.headers.get("host");
  } catch {
    return false;
  }
}

export async function guarded(req: Request | null, fn: () => Promise<Response>): Promise<Response> {
  if (!adminEnabled()) return notFound();
  if (req && !sameOrigin(req)) return Response.json({ error: "허용되지 않은 요청이에요." }, { status: 403 });
  try {
    return await fn();
  } catch (e) {
    if (e instanceof AdminError) return Response.json({ error: e.message }, { status: e.status });
    return Response.json({ error: "처리하지 못했어요. 다시 해 보세요." }, { status: 500 });
  }
}
