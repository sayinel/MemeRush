// A screen = a list of elements. Names must match the keys of web/src/game/layout_<screen>.ts.
export type ElementDef = {
  name: string;
  kind: "image" | "text";
  /** image: file under web/public/game/ */
  src?: string;
  /** text: the real in-game string */
  text?: string;
  color?: string; // text fill
  stroke?: number; // outline width in game px
  bg?: "none" | "pill"; // text on a navy pill (round badge)
  /** y in the layout file is the box bottom (hero) instead of the center */
  anchor?: "center" | "bottom";
};
export type ScreenDef = {
  id: string;
  label: string;
  bg: string; // locked background file under web/public/game/
  elements: ElementDef[];
};
export const INK = "#14192E";
export const GOLD = "#FEDE25";
