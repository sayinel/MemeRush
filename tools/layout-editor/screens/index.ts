import { dalgona_email_input } from "./dalgona_email_input";
import { dalgona_email_invalid } from "./dalgona_email_invalid";
import { dalgona_email_failed } from "./dalgona_email_failed";
import { dalgona_email_sent } from "./dalgona_email_sent";
import { dalgona_result_perfect } from "./dalgona_result_perfect";
import { dalgona_result_early } from "./dalgona_result_early";
import { dalgona_result_late } from "./dalgona_result_late";
import { dalgona_intro } from "./dalgona_intro";
import { dalgona_ranking } from "./dalgona_ranking";
import { dalgona_email_hook } from "./dalgona_email_hook";
import { banner_next_ep } from "./banner_next_ep";
import { dalgona } from "./dalgona";
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
  dalgona,
  banner_next_ep,
  dalgona_email_hook,
  dalgona_intro,
  dalgona_ranking,
  dalgona_result_perfect,
  dalgona_result_early,
  dalgona_result_late,
  dalgona_email_input,
  dalgona_email_invalid,
  dalgona_email_failed,
  dalgona_email_sent,
];
export const PENDING: string[] = [];
