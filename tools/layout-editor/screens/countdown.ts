import { round1 } from "./round1";
import type { ScreenDef } from "./types";

// The game has NO 3-2-1-GO. After "지금 플레이" the scene shows the GET READY step (ribbon slides in next to the hero,
// 2 s) and that is exactly the round1 screen, so this entry edits the same numbers (web/src/game/layout_round1.ts).
export const countdown: ScreenDef = {
  ...round1,
  id: "countdown",
  label: "카운트다운 = GET READY (round1과 같은 화면, 같은 좌표)",
  layoutId: "round1",
};
