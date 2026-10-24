import "server-only";
import { execFile } from "node:child_process";
import { mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import { promisify } from "node:util";
import ffmpegPath from "ffmpeg-static";
import { ImageResponse } from "next/og";

const run = promisify(execFile);

const W = 720;
const H = 1280;
const DURATION_S = 10;
const anton = readFile(path.join(process.cwd(), "assets/fonts/Anton-Regular.ttf"));

export type CaptionLine = { text: string; y: "top" | "middle" | "bottom"; size?: number };
export type Scene = { from: number; to: number; lines: CaptionLine[] };
export type VideoSpec = {
  background: string; // ffmpeg color, e.g. "0x29BAF5"
  scenes: Scene[];
};

const TOP: Record<CaptionLine["y"], number> = { top: 0.1, middle: 0.46, bottom: 0.78 };

// One transparent full-frame PNG per scene. Text is drawn by the OG renderer (satori), not ffmpeg drawtext:
// the Linux ffmpeg-static build has no drawtext filter (no freetype), while overlay is always built in.
async function sceneImage(scene: Scene): Promise<Buffer> {
  const res = new ImageResponse(
    (
      <div style={{ width: W, height: H, display: "flex", position: "relative" }}>
        {scene.lines.map((l, i) => (
          <div
            key={i}
            style={{
              position: "absolute",
              left: 0,
              width: W,
              top: Math.round(H * TOP[l.y]),
              display: "flex",
              justifyContent: "center",
              textAlign: "center",
              fontFamily: "Anton",
              fontSize: l.size ?? 76,
              color: "white",
              textTransform: "uppercase",
              WebkitTextStroke: "7px black",
              paddingLeft: 24,
              paddingRight: 24,
            }}
          >
            {l.text}
          </div>
        ))}
      </div>
    ),
    { width: W, height: H, fonts: [{ name: "Anton", data: await anton, weight: 400, style: "normal" }] },
  );
  return Buffer.from(await res.arrayBuffer());
}

// Renders a 720x1280, 30fps, 10s silent H.264 MP4 (MVP_SCOPE 7절) and returns its bytes.
export async function renderVideo(spec: VideoSpec): Promise<Buffer> {
  if (!ffmpegPath) throw new Error("ffmpeg binary not found");
  const dir = await mkdtemp(path.join(tmpdir(), "mr-render-"));
  try {
    const inputs: string[] = ["-f", "lavfi", "-i", `color=c=${spec.background}:s=${W}x${H}:d=${DURATION_S}:r=30`];
    const chain: string[] = [];
    let last = "0:v";
    for (const [i, scene] of spec.scenes.entries()) {
      const file = path.join(dir, `scene${i}.png`);
      await writeFile(file, await sceneImage(scene));
      inputs.push("-loop", "1", "-t", String(DURATION_S), "-i", file);
      const out = `v${i}`;
      chain.push(`[${last}][${i + 1}:v]overlay=0:0:enable='between(t,${scene.from},${scene.to})'[${out}]`);
      last = out;
    }
    const out = path.join(dir, "out.mp4");
    await run(ffmpegPath, [
      "-hide_banner", "-loglevel", "error",
      ...inputs,
      ...(chain.length ? ["-filter_complex", chain.join(";"), "-map", `[${last}]`] : []),
      "-c:v", "libx264", "-preset", "veryfast", "-crf", "23",
      "-pix_fmt", "yuv420p", "-movflags", "+faststart", "-an", "-r", "30",
      "-t", String(DURATION_S), "-y", out,
    ]);
    return await readFile(out);
  } finally {
    await rm(dir, { recursive: true, force: true });
  }
}
