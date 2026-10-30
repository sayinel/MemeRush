// Phaser screens (play, final_grabbed): numbers come from web/src/game/TimingStopScene.ts constants and
// layout_round1.ts (exact), or from the capture refs/game_*.png converted to 720x1280 px (marked "추정").
// usage: node hand_screens.mjs   (writes screens/<id>.ts and web/src/game/layout_<id>.ts)
import path from "node:path";
import { fileURLToPath } from "node:url";
import { emitScreen } from "./emit.mjs";

const here = path.dirname(fileURLToPath(import.meta.url));
const INK = "#14192E";
const GOLD = "#FEDE25";
const A = { family: "anton", weight: 400, align: "center" };
const cap = (stroke = 14) => ({ ...A, color: "#FFFFFF", stroke, strokeColor: INK });

const img = (name, src, x, y, w, h, extra = {}) => ({ name, kind: "image", x, y, w, h, def: { src, ...extra } });
const txt = (name, text, x, y, w, h, font, def) => ({ name, kind: "text", text, x, y, w, h, font, def: { ...def } });
const pill = (name, text, x, y, w, color) => ({
  name, kind: "box", text, x, y, w, h: 48, font: 26,
  def: { ...A, color, stroke: 6, strokeColor: INK, fill: "#1f4788", border: "#FFFFFF", borderW: 4, radius: 24 },
});

// shared with round1 (these ARE the numbers the game reads from layout_round1.ts)
const common = [
  img("clock_panel", "timer_panel.png", 363, 473, 774, 272),
  img("star_left", "confetti_star.png", 100.5, 337.5, 77, 77),
  img("star_right", "confetti_star.png", 620.5, 337.5, 77, 77),
];

const play = {
  label: "플레이 중(play)",
  bg: "bg_office.webp",
  items: [
    ...common,
    txt("clock_digits", "6:59:55.00", 360, 486, 490, 178, 90, { ...A, color: GOLD, stroke: 10, strokeColor: INK, note: "플레이 중에는 아래 hider가 가린다" }),
    img("hider", "meeting_card.png", 363, 473, 620, 280, { fit: "fill", note: "라운드 1의 가림막(meeting_card). 코드: 620x280, 시계 중심에 4도 기울어 내려앉음 (각도는 편집기에서 못 만짐)" }),
    img("button", "clock_button.png", 498, 869, 276, 182),
    img("hero", "worker_sweating.png", 210, 989, 380, 380, { anchor: "bottom", note: "y = 박스 아래 끝(layout_round1.hero와 같은 뜻)" }),
    { ...pill("badge_round", "ROUND 1/3", 118, 52, 196, "#FFFFFF"), x: 118 },
    txt("caption_top", "TAKE 1: COZY SLIPPERS ON", 360, 170, 530, 84, 56, cap(14)),
    txt("tap_at", "TAP AT 7:00:00", 360, 1075, 470, 120, 80, cap(14)),
  ],
};

const FLOOR_Y = 955;
const final_grabbed = {
  label: "최종: 끌려가는 장면(final_grabbed)",
  bg: "bg_office.webp",
  items: [
    pill("badge_round", "ROUND 3/3", 118, 52, 196, "#FFFFFF"),
    pill("hud_r1", "R1 -2.672s", 299, 52, 154, "#FFC531"),
    pill("hud_r2", "R2 -3.264s", 461, 52, 154, "#FFC531"),
    pill("hud_r3", "R3 -3.285s", 623, 52, 154, "#FFC531"),
    txt("caption_top", "NOT SO FAST.", 360, 245, 520, 100, 80, cap(16)),
    txt("result_number", "0.780s", 360, 525, 420, 190, 160, { ...A, color: "#C93A52", stroke: 16, strokeColor: "#FFFFFF", shadow: `0px 10px 0px ${INK}`, note: "코드: 중심 (360,525), 폰트 160. 폭·높이는 캡처 환산(추정)" }),
    img("door", "door.png", 680, 822, 170, 290, { note: "코드: DOOR(640,822)+40, 170x290" }),
    img("drag_combo", "drag_combo.png", 360, FLOOR_Y + 30, 610, 512, { anchor: "bottom", note: "추정: 오른쪽에서 왼쪽으로 이동하는 중 가운데 프레임. 코드: 높이 H*0.4=512, 발 y=985 (너비는 원본 847x710 비율)" }),
    txt("caption_bottom", "BACK TO YOUR DESK", 360, 1132, 640, 100, 80, cap(16)),
  ],
};

for (const [id, d] of Object.entries({ play, final_grabbed })) {
  const items = d.items.map((i) => ({ ...i, def: { ...i.def } }));
  for (const i of items) if (i.def.anchor === "bottom") continue;
  emitScreen(here, id, { label: d.label, bg: d.bg }, { items });
  console.log(id, items.length, "elements");
}
