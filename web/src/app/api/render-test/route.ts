import { renderVideo } from "@/lib/render";

export const maxDuration = 60;

// Render spike (MVP_SCOPE 10절 체크포인트): proves ffmpeg runs in the deploy environment.
// Remove once /api/videos exists.
export async function GET() {
  const started = Date.now();
  try {
    const mp4 = await renderVideo({
      background: "0x29BAF5",
      captions: [
        { text: "4:59:55… ALMOST FREE", from: 0, to: 3, y: "middle" },
        { text: "QUICK SYNC?", from: 3, to: 7, y: "top" },
        { text: "MY WEEKEND IS GONE", from: 7, to: 10, y: "bottom" },
        { text: "0.087s off · BEAT ME!", from: 7, to: 10, y: "middle", size: 56 },
      ],
    });
    return new Response(new Uint8Array(mp4), {
      headers: {
        "Content-Type": "video/mp4",
        "Cache-Control": "no-store",
        "X-Render-Ms": String(Date.now() - started),
      },
    });
  } catch (e) {
    return Response.json({ ok: false, error: (e as Error).message }, { status: 500 });
  }
}
