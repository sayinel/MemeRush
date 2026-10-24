import "server-only";
import { execFile } from "node:child_process";
import { mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import { promisify } from "node:util";
import ffmpegPath from "ffmpeg-static";

const run = promisify(execFile);

const FONT = path.join(process.cwd(), "assets/fonts/Anton-Regular.ttf");
const W = 720;
const H = 1280;
const DURATION_S = 10;

export type Caption = { text: string; from: number; to: number; y: "top" | "bottom" | "middle"; size?: number };

export type VideoSpec = {
  background: string; // ffmpeg color, e.g. "0x29BAF5"
  captions: Caption[];
};

const Y = { top: "h*0.10", middle: "(h-text_h)/2", bottom: "h*0.78" } as const;

// Renders a 720x1280, 30fps, 10s silent H.264 MP4 (MVP_SCOPE 7절) and returns its bytes.
// Caption text goes through textfile= so user text never needs filter-graph escaping.
export async function renderVideo(spec: VideoSpec): Promise<Buffer> {
  if (!ffmpegPath) throw new Error("ffmpeg binary not found");
  const dir = await mkdtemp(path.join(tmpdir(), "mr-render-"));
  try {
    const filters: string[] = [];
    for (const [i, c] of spec.captions.entries()) {
      const file = path.join(dir, `cap${i}.txt`);
      await writeFile(file, c.text);
      filters.push(
        `drawtext=fontfile='${FONT}':textfile='${file}':fontsize=${c.size ?? 76}:fontcolor=white:borderw=7:bordercolor=black:` +
          `x=(w-text_w)/2:y=${Y[c.y]}:enable='between(t,${c.from},${c.to})'`,
      );
    }
    const out = path.join(dir, "out.mp4");
    await run(ffmpegPath, [
      "-hide_banner", "-loglevel", "error",
      "-f", "lavfi", "-i", `color=c=${spec.background}:s=${W}x${H}:d=${DURATION_S}:r=30`,
      "-vf", filters.join(",") || "null",
      "-c:v", "libx264", "-preset", "veryfast", "-crf", "23",
      "-pix_fmt", "yuv420p", "-movflags", "+faststart", "-an",
      "-t", String(DURATION_S), "-y", out,
    ]);
    return await readFile(out);
  } finally {
    await rm(dir, { recursive: true, force: true });
  }
}
