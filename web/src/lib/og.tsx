import "server-only";
import { readFile } from "node:fs/promises";
import path from "node:path";
import { ImageResponse } from "next/og";

// Link preview card, 1200x630 (MVP_SCOPE 6절 미리보기). Look: SERVICE_UX_GUIDE (dark bg, fire orange, Anton).
export const OG_SIZE = { width: 1200, height: 630 };

const anton = readFile(path.join(process.cwd(), "assets/fonts/Anton-Regular.ttf"));
const worker = readFile(path.join(process.cwd(), "public/game/worker_smug.png")).then(
  (b) => `data:image/png;base64,${b.toString("base64")}`,
);

const C = { bg: "#140C09", bg2: "#1F130E", ink: "#FFF4E8", muted: "#BDB3AA", fire: "#FF6A2B", fireShadow: "#9A3A12", gold: "#FFB547" };

export type OgCard = { kicker: string; headline: string; sub: string };

export async function ogImage(card: OgCard, headers?: Record<string, string>): Promise<ImageResponse> {
  return new ImageResponse(
    (
      <div
        style={{
          width: "100%",
          height: "100%",
          display: "flex",
          backgroundColor: C.bg,
          backgroundImage: `radial-gradient(circle at 78% 55%, ${C.fireShadow} 0%, ${C.bg2} 38%, ${C.bg} 70%)`,
          fontFamily: "Anton",
          padding: "56px 64px",
        }}
      >
        <div style={{ display: "flex", flexDirection: "column", justifyContent: "space-between", width: 760 }}>
          <div style={{ display: "flex", fontSize: 44, color: C.fire, letterSpacing: 2 }}>MEME RUSH</div>
          <div style={{ display: "flex", flexDirection: "column" }}>
            <div style={{ display: "flex", fontSize: 34, color: C.muted, textTransform: "uppercase" }}>{card.kicker}</div>
            <div style={{ display: "flex", fontSize: 150, lineHeight: 1.02, color: C.ink }}>{card.headline}</div>
          </div>
          <div style={{ display: "flex", fontSize: 64, color: C.gold, textTransform: "uppercase" }}>{card.sub}</div>
        </div>
        <div style={{ display: "flex", flex: 1, alignItems: "center", justifyContent: "center" }}>
          {/* eslint-disable-next-line @next/next/no-img-element -- satori needs a plain img */}
          <img src={await worker} width={380} height={380} alt="" />
        </div>
      </div>
    ),
    {
      ...OG_SIZE,
      fonts: [{ name: "Anton", data: await anton, weight: 400, style: "normal" }],
      headers,
    },
  );
}
