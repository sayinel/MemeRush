import { countdown } from "./countdown";
import { email_failed } from "./email_failed";
import { email_input } from "./email_input";
import { email_invalid } from "./email_invalid";
import { email_sent } from "./email_sent";
import { final_grabbed } from "./final_grabbed";
import { intro } from "./intro";
import { play } from "./play";
import { ranking } from "./ranking";
import { result_early } from "./result_early";
import { result_late } from "./result_late";
import { result_perfect } from "./result_perfect";
import { round1 } from "./round1";
import type { ScreenDef } from "./types";

// Next screen = add screens/<id>.ts + one line here (and web/src/game/layout_<id>.ts for the coordinates).
// Order = the order of the game flow.
export const SCREENS: ScreenDef[] = [
  intro,
  countdown,
  round1,
  play,
  final_grabbed,
  result_late,
  result_early,
  result_perfect,
  ranking,
  email_input,
  email_invalid,
  email_failed,
  email_sent,
];
export const PENDING: string[] = [];
