import "server-only";
import { execFile } from "node:child_process";
import { existsSync } from "node:fs";
import { mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import { promisify } from "node:util";
import ffmpegPath from "ffmpeg-static";
import { ImageResponse } from "next/og";

const run = promisify(execFile);

const W = 720;
const H = 1280;
const FPS = 30;
const anton = readFile(path.join(process.cwd(), "assets/fonts/Anton-Regular.ttf"));
const GAME_DIR = path.join(process.cwd(), "public/game");
// Video backgrounds, 1440x2560 (SIMON_REQUESTS 2절, ASSET_FORMATS 1번); not served, only composed into the video.
const VIDEO_DIR = path.join(process.cwd(), "assets/video");

// y: top edge of the line as a fraction of the frame height.
export type CaptionLine = { text: string; y: number; size?: number; color?: string; keepCase?: boolean };
export type Scene = {
  seconds: number;
  mood: "win" | "lose"; // picks assets/video/bg_win|bg_lose.png, or the matching sky gradient
  sprite: string; // key in public/game/manifest.json, e.g. "worker_crying"
  lines: CaptionLine[];
};

const GRADIENT = { win: "linear-gradient(180deg, #80E3FE 0%, #3EAEF5 60%, #1C5692 100%)", lose: "linear-gradient(180deg, #4CC0F7 0%, #1C5692 55%, #0F3A73 100%)" };

async function dataUri(file: string): Promise<string> {
  return `data:image/png;base64,${(await readFile(file)).toString("base64")}`;
}

async function background(mood: Scene["mood"]): Promise<string | null> {
  const file = path.join(VIDEO_DIR, `bg_${mood}.png`);
  return existsSync(file) ? dataUri(file) : null;
}

async function art(key: string): Promise<string | null> {
  const manifest = JSON.parse(await readFile(path.join(GAME_DIR, "manifest.json"), "utf8")) as Record<string, string>;
  const file = manifest[key] && path.join(GAME_DIR, manifest[key]);
  if (!file || !existsSync(file)) return null;
  return dataUri(file);
}

// Top and bottom 25% stay free for captions (MEME_GAME_DESIGN 5절); the sprite sits in the middle.
// One full-frame PNG per scene: background, sprite and captions together, drawn by the OG renderer (satori).
// ffmpeg then only concatenates stills — the Linux ffmpeg-static build has no drawtext, and stacking looped
// overlays made every frame decode several PNGs (≈12s per render on Vercel).
async function sceneImage(scene: Scene): Promise<Buffer> {
  const [bg, sprite] = await Promise.all([background(scene.mood), art(scene.sprite)]);
  const res = new ImageResponse(
    (
      <div style={{ width: W, height: H, display: "flex", position: "relative", backgroundImage: GRADIENT[scene.mood] }}>
        {/* eslint-disable @next/next/no-img-element -- satori needs plain img */}
        {bg && <img src={bg} width={W} height={H} alt="" style={{ position: "absolute", left: 0, top: 0, objectFit: "cover" }} />}
        {sprite && <img src={sprite} width={520} height={520} alt="" style={{ position: "absolute", left: (W - 520) / 2, top: 300 }} />}
        {/* eslint-enable @next/next/no-img-element */}
        {scene.lines.map((l, i) => (
          <div
            key={i}
            style={{
              position: "absolute",
              left: 0,
              width: W,
              top: Math.round(H * l.y),
              display: "flex",
              justifyContent: "center",
              textAlign: "center",
              fontFamily: "Anton",
              fontSize: l.size ?? 76,
              lineHeight: 1.1,
              color: l.color ?? "white",
              textTransform: l.keepCase ? "none" : "uppercase",
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

// Renders a 720x1280, 30fps, silent H.264 MP4 (MVP_SCOPE 7절) and returns its bytes.
export async function renderVideo(scenes: Scene[]): Promise<Buffer> {
  if (!ffmpegPath) throw new Error("ffmpeg binary not found");
  const dir = await mkdtemp(path.join(tmpdir(), "mr-render-"));
  try {
    const files = await Promise.all(
      scenes.map(async (scene, i) => {
        const file = path.join(dir, `scene${i}.png`);
        await writeFile(file, await sceneImage(scene));
        return file;
      }),
    );
    const inputs = scenes.flatMap((s, i) => ["-loop", "1", "-framerate", String(FPS), "-t", String(s.seconds), "-i", files[i]]);
    // Short fade-in per scene so the cuts read as beats, then join the stills.
    const fades = scenes.map((_, i) => `[${i}:v]format=yuv420p,fade=t=in:st=0:d=0.2[s${i}]`);
    const concat = `${scenes.map((_, i) => `[s${i}]`).join("")}concat=n=${scenes.length}:v=1:a=0[v]`;
    const out = path.join(dir, "out.mp4");
    await run(ffmpegPath, [
      "-hide_banner", "-loglevel", "error",
      ...inputs,
      "-filter_complex", [...fades, concat].join(";"), "-map", "[v]",
      "-c:v", "libx264", "-preset", "veryfast", "-tune", "stillimage", "-crf", "23",
      "-pix_fmt", "yuv420p", "-movflags", "+faststart", "-an", "-r", String(FPS), "-y", out,
    ]);
    return await readFile(out);
  } finally {
    await rm(dir, { recursive: true, force: true });
  }
}
