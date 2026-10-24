import type { Challenge } from "@/lib/challenge";

// Phaser-free module: safe to import from server-rendered client components.

export const TIMING_STOP_SCENE_KEY = "TimingStop";
export const GAME_WIDTH = 720;
export const GAME_HEIGHT = 1280;

export type FinishResult = {
  outcome: "win" | "lose";
  outcomeVariant: "early" | "late" | null;
  roundErrorsMs: number[];
  errorMs: number;
};

export type GameBridge = {
  beforeStart: () => Promise<void>;
  complete: (roundElapsedMs: number[]) => Promise<FinishResult>;
  finished: (result: FinishResult) => void;
};

export type TimingStopSceneData = {
  challenge: Challenge;
  bridge: GameBridge;
};
