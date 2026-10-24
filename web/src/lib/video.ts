import "server-only";
import type { Challenge } from "./challenge";
import { fillCaption, pickCaption, type Played } from "@/game/captions";
import type { Scene } from "./render";

// Result highlight, three beats (MEME_GAME_DESIGN 5절): hope → twist (caption top) → meme result (caption bottom,
// rank, BEAT ME!, public challenge URL without ref). All copy comes from the day file's meme card.
export function resultScenes(challenge: Challenge, played: Played, rank: number, publicUrl: string): Scene[] {
  const caption = pickCaption(challenge, played);
  const fill = (s: string) => fillCaption(challenge, s, played);
  const win = played.outcome === "win";
  const early = played.outcomeVariant === "early";
  const mood = win ? "win" : "lose";
  return [
    {
      seconds: 2.5,
      mood: "win",
      sprite: "worker_sweating",
      lines: [
        { text: fill(challenge.meme.hope), y: 0.08 },
        { text: challenge.title, y: 0.8, size: 56 },
      ],
    },
    {
      seconds: 3.5,
      mood,
      sprite: win ? "worker_proud" : early ? "worker_shocked" : "worker_facepalm",
      lines: [{ text: fill(caption.top), y: 0.08 }],
    },
    {
      seconds: 4,
      mood,
      sprite: win ? "worker_smug" : "worker_crying",
      lines: [
        { text: `${(played.errorMs / 1000).toFixed(3)}s off`, y: 0.05, size: 110, color: "#FEDE25", keepCase: true },
        { text: `WORLD #${rank}`, y: 0.17, size: 56 },
        { text: fill(caption.bottom), y: 0.68, size: 68 },
        { text: "BEAT ME!", y: 0.8, size: 84, color: "#FEDE25" },
        { text: publicUrl, y: 0.92, size: 34, keepCase: true },
      ],
    },
  ];
}
