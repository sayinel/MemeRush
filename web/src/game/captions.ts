import type { Challenge } from "@/lib/challenge";

// Caption logic shared by the game scene and the server-rendered result video, so both say the same thing.
// Phaser-free and server-safe.

export type Outcome = { outcome: "win" | "lose"; outcomeVariant: "early" | "late" | null };
export type Played = Outcome & { roundElapsedMs: number[]; errorMs: number };

export function parseLabel(label: string): number {
  const [h = 0, m = 0, s = 0] = label.split(":").map(Number);
  return ((h * 60 + m) * 60 + s) * 1000;
}

export function formatClock(ms: number, withCs = true): string {
  const total = Math.max(0, Math.floor(ms));
  const h = Math.floor(total / 3600000);
  const m = Math.floor(total / 60000) % 60;
  const s = Math.floor(total / 1000) % 60;
  const base = `${h}:${String(m).padStart(2, "0")}:${String(s).padStart(2, "0")}`;
  return withCs ? `${base}.${String(Math.floor(total / 10) % 100).padStart(2, "0")}` : base;
}

// win → meme.win; lose → the early/late branch when the card has one, else meme.lose.
export function pickCaption(challenge: Challenge, r: Outcome) {
  const { meme } = challenge;
  if (r.outcome === "win") return meme.win;
  return (r.outcomeVariant && meme.lose[r.outcomeVariant]) || meme.lose;
}

export function fillCaption(challenge: Challenge, s: string, r: Played): string {
  const { frameParams, meme } = challenge;
  const errs = r.roundElapsedMs.map((e, i) => Math.abs(e - frameParams.targetMs[i]));
  // Highlight round: most accurate on win, worst on lose (docs/MEME_GAME_DESIGN.md §5).
  const pick = errs.reduce((best, e, i) => ((r.outcome === "win" ? e < errs[best] : e > errs[best]) ? i : best), 0);
  const stop = r.roundElapsedMs[pick] ?? 0;
  const stopLabel = formatClock(parseLabel(meme.theme.rounds[pick].startLabel) + stop);
  const rounds = meme.theme.rounds;
  return s
    .replaceAll("{result}", `${(r.errorMs / 1000).toFixed(3)}s off`)
    .replaceAll("{stopLabel}", stopLabel)
    .replaceAll("{nearLabel}", rounds[rounds.length - 1].startLabel);
}
