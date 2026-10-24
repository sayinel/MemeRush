import type { Challenge } from "./challenge";

// timing_stop scoring and validation (MVP_SCOPE 2절, MEME_GAME_DESIGN 4절).
export const WIN_MAX_TOTAL_ERROR_MS = 300;
const ROUND_MIN_MS = 1000;
const ROUND_MAX_MS = 15000;
const CLOCK_TOLERANCE_MS = 50;

export type TimingResult = {
  roundErrorsMs: number[];
  errorMs: number;
  outcome: "win" | "lose";
  outcomeVariant: "early" | "late" | null;
};

export function validateRounds(challenge: Challenge, roundElapsedMs: unknown, serverElapsedMs: number): string | null {
  const { rounds } = challenge.frameParams;
  if (!Array.isArray(roundElapsedMs) || roundElapsedMs.length !== rounds) return `expected ${rounds} round measurements`;
  if (!roundElapsedMs.every((v) => Number.isInteger(v) && v >= ROUND_MIN_MS && v <= ROUND_MAX_MS)) {
    return `each round must be an integer between ${ROUND_MIN_MS} and ${ROUND_MAX_MS} ms`;
  }
  const total = roundElapsedMs.reduce((a: number, b: number) => a + b, 0);
  if (total > serverElapsedMs + CLOCK_TOLERANCE_MS) return "measurements exceed server elapsed time";
  return null;
}

export function scoreRounds(challenge: Challenge, roundElapsedMs: number[]): TimingResult {
  const targets = challenge.frameParams.targetMs;
  const signed = roundElapsedMs.map((e, i) => e - targets[i]);
  const roundErrorsMs = signed.map(Math.abs);
  const errorMs = roundErrorsMs.reduce((a, b) => a + b, 0);
  if (errorMs <= WIN_MAX_TOTAL_ERROR_MS) return { roundErrorsMs, errorMs, outcome: "win", outcomeVariant: null };
  const worst = roundErrorsMs.indexOf(Math.max(...roundErrorsMs));
  return { roundErrorsMs, errorMs, outcome: "lose", outcomeVariant: signed[worst] < 0 ? "early" : "late" };
}
