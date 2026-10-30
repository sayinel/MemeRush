import { round1 } from "./round1";
import type { ScreenDef } from "./types";

// Next screen = add screens/<id>.ts + one line here (and web/src/game/layout_<id>.ts for the coordinates).
export const SCREENS: ScreenDef[] = [round1];
export const PENDING = ["intro", "play", "result", "ranking", "email"];
