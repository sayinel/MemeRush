"use client";

import { useEffect, useRef, type JSX } from "react";
import type { Game } from "phaser";
import type { Challenge } from "@/lib/challenge";
import {
  GAME_HEIGHT,
  GAME_WIDTH,
  TIMING_STOP_SCENE_KEY,
  type FinishResult,
  type GameBridge,
  type TimingStopSceneData,
} from "./types";

export type { FinishResult } from "./types";

export type GameCanvasProps = {
  challenge: Challenge;
  beforeStart: () => Promise<void>; // parent creates the server attempt; round 1 timing starts after this resolves
  onComplete: (roundElapsedMs: number[]) => Promise<FinishResult>; // called once after round 3; scene plays the final outcome when it resolves
  onFinished: (result: FinishResult) => void; // called after the final outcome animation ends
  playKey: number; // parent increments to restart from round 1 (retry)
};

export default function GameCanvas(props: GameCanvasProps): JSX.Element {
  const { challenge, playKey } = props;
  const hostRef = useRef<HTMLDivElement>(null);
  const gameRef = useRef<Game | null>(null);
  const propsRef = useRef(props);
  // Stable bridge so the scene always calls the latest callbacks without remounting.
  const bridgeRef = useRef<GameBridge>({
    beforeStart: () => propsRef.current.beforeStart(),
    complete: (ms) => propsRef.current.onComplete(ms),
    finished: (result) => propsRef.current.onFinished(result),
  });

  useEffect(() => {
    propsRef.current = props;
  });

  useEffect(() => {
    let cancelled = false;
    let game: Game | null = null;
    (async () => {
      const Phaser = await import("phaser");
      const { TimingStopScene } = await import("./TimingStopScene");
      // Let the Anton face load if the page declares one, so canvas text doesn't render in the fallback font.
      await document.fonts?.load('64px "Anton"').catch(() => undefined);
      if (cancelled || !hostRef.current) return;
      game = new Phaser.Game({
        type: Phaser.AUTO,
        parent: hostRef.current,
        width: GAME_WIDTH,
        height: GAME_HEIGHT,
        backgroundColor: "#29BAF5",
        banner: false,
        audio: { noAudio: true },
        scale: { mode: Phaser.Scale.FIT, autoCenter: Phaser.Scale.CENTER_BOTH },
      });
      const data: TimingStopSceneData = { challenge, bridge: bridgeRef.current };
      game.scene.add(TIMING_STOP_SCENE_KEY, TimingStopScene, true, data);
      gameRef.current = game;
    })();
    return () => {
      cancelled = true;
      game?.destroy(true);
      gameRef.current = null;
    };
  }, [challenge]);

  useEffect(() => {
    // First mount is handled by game creation above; later playKey changes restart from round 1.
    const scene = gameRef.current?.scene.getScene(TIMING_STOP_SCENE_KEY);
    if (!scene) return;
    const data: TimingStopSceneData = { challenge, bridge: bridgeRef.current };
    scene.scene.restart(data);
  }, [playKey, challenge]);

  return (
    <div
      ref={hostRef}
      className="relative mx-auto w-full max-h-dvh overflow-hidden select-none"
      style={{ aspectRatio: `${GAME_WIDTH} / ${GAME_HEIGHT}`, touchAction: "manipulation" }}
    />
  );
}
