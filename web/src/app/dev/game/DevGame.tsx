"use client";

// Throwaway dev harness for the game scene without the backend.

import { useState } from "react";
import GameCanvas, { type FinishResult } from "@/game/GameCanvas";
import type { Challenge } from "@/lib/challenge";

const sleep = (ms: number) => new Promise<void>((r) => setTimeout(r, ms));

async function beforeStart() {
  await sleep(200);
}

async function onComplete(challenge: Challenge, elapsed: number[]): Promise<FinishResult> {
  await sleep(300);
  const targets = challenge.frameParams.targetMs;
  const roundErrorsMs = elapsed.map((e, i) => Math.abs(e - targets[i]));
  const errorMs = roundErrorsMs.reduce((a, b) => a + b, 0);
  // Preview a specific ending: /dev/game?outcome=win|early|late
  const forced = new URLSearchParams(window.location.search).get("outcome");
  if (forced === "win") return { outcome: "win", outcomeVariant: null, roundErrorsMs, errorMs };
  if (forced === "early" || forced === "late") return { outcome: "lose", outcomeVariant: forced, roundErrorsMs, errorMs };
  if (errorMs <= 300) return { outcome: "win", outcomeVariant: null, roundErrorsMs, errorMs };
  const worst = roundErrorsMs.indexOf(Math.max(...roundErrorsMs));
  return { outcome: "lose", outcomeVariant: elapsed[worst] < targets[worst] ? "early" : "late", roundErrorsMs, errorMs };
}

export default function DevGame({ challenge }: { challenge: Challenge }) {
  const [playKey, setPlayKey] = useState(0);
  const [result, setResult] = useState<FinishResult | null>(null);

  return (
    <main className="flex min-h-dvh flex-col items-center bg-black text-white">
      <div className="w-full max-w-[480px]">
        <GameCanvas
          challenge={challenge}
          beforeStart={beforeStart}
          onComplete={(elapsed) => onComplete(challenge, elapsed)}
          onFinished={setResult}
          playKey={playKey}
        />
      </div>
      <div className="flex gap-4 p-3 text-sm">
        <span>{result ? `${result.outcome} ${result.outcomeVariant ?? ""} ${result.errorMs}ms` : "playing…"}</span>
        <button
          className="rounded bg-green-700 px-3 py-1"
          onClick={() => {
            setResult(null);
            setPlayKey((k) => k + 1);
          }}
        >
          Retry
        </button>
      </div>
    </main>
  );
}
