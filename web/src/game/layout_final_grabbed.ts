// 최종: 끌려가는 장면(final_grabbed) layout (coordinates = the 720x1280 game frame 1:1; x,y = element CENTER; w,h = displayed size; font = px).
// Measured from the running game (DOM getBoundingClientRect). NOT read by game code yet: the game still uses its own CSS/Phaser
// values; this file only holds the same numbers for the layout editor (tools/layout-editor, apply_layout.mjs final_grabbed).
export const FINAL_GRABBED_LAYOUT = {
  badge_round: { x: 118, y: 52, w: 196, h: 48, font: 26 },
  hud_r1: { x: 299, y: 52, w: 154, h: 48, font: 26 },
  hud_r2: { x: 461, y: 52, w: 154, h: 48, font: 26 },
  hud_r3: { x: 623, y: 52, w: 154, h: 48, font: 26 },
  caption_top: { x: 360, y: 245, w: 520, h: 100, font: 80 },
  result_number: { x: 360, y: 525, w: 420, h: 190, font: 160 }, // 코드: 중심 (360,525), 폰트 160. 폭·높이는 캡처 환산(추정)
  door: { x: 680, y: 822, w: 170, h: 290 }, // 코드: DOOR(640,822)+40, 170x290
  drag_combo: { x: 360, y: 985, w: 610, h: 512 }, // 추정: 오른쪽에서 왼쪽으로 이동하는 중 가운데 프레임. 코드: 높이 H*0.4=512, 발 y=985 (너비는 원본 847x710 비율)
  caption_bottom: { x: 360, y: 1132, w: 640, h: 100, font: 80 },
  next_banner: { x: 360, y: 1190, w: 560, h: 149 },
} as const;
