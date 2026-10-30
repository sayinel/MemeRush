// A screen = a list of elements. Names must match the keys of web/src/game/layout_<screen>.ts.
export type ElementDef = {
  name: string;
  kind: "image" | "text" | "box";
  /** image: file under web/public/game/ */
  src?: string;
  /** text / box label: the real in-game string. [[...]] = gold part (#ffd54a) */
  text?: string;
  color?: string; // text fill
  stroke?: number; // outline width in game px (CSS text-stroke, centered)
  strokeColor?: string;
  family?: "anton" | "sans"; // anton = game font, sans = Noto Sans KR
  weight?: number;
  align?: "center" | "left" | "right";
  shadow?: string; // css text-shadow
  fill?: string; // box background (css color or gradient)
  border?: string; // box border color
  borderW?: number;
  radius?: number;
  bg?: "none" | "pill"; // legacy round1 badge
  /** y in the layout file is the box bottom (hero) instead of the center */
  anchor?: "center" | "bottom";
  /** image: "fill" = stretched to w x h (the game uses setDisplaySize), default contain */
  fit?: "contain" | "fill";
  /** note shown in the panel, e.g. "추정: 캡처 픽셀 환산" */
  note?: string;
};
export type ScreenDef = {
  id: string;
  label: string;
  /** locked background picture under web/public/game/ (omit when bgCss is used) */
  bg?: string;
  /** css background for the frame (gradient screens) */
  bgCss?: string;
  /** coordinates live in web/src/game/layout_<layoutId>.ts (default = id) */
  layoutId?: string;
  elements: ElementDef[];
};
export const INK = "#14192E";
export const GOLD = "#FEDE25";
