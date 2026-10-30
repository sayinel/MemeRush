// 결과: PERFECT layout (coordinates = the 720x1280 game frame 1:1; x,y = element CENTER; w,h = displayed size; font = px).
// Measured from the running game (DOM getBoundingClientRect). NOT read by game code yet: the game still uses its own CSS/Phaser
// values; this file only holds the same numbers for the layout editor (tools/layout-editor, apply_layout.mjs result_perfect).
export const RESULT_PERFECT_LAYOUT = {
  chip: { x: 97.9, y: 42.7, w: 152.6, h: 49.4, font: 25.9 },
  lang_toggle: { x: 637.8, y: 41.5, w: 121.2, h: 47, font: 23.8 },
  caption_top: { x: 360, y: 106.4, w: 720, h: 54.4, font: 51.8 },
  verdict: { x: 360, y: 239.4, w: 288.8, h: 90, font: 90 },
  score: { x: 360, y: 345.6, w: 411.2, h: 108, font: 108 },
  badge: { x: 360, y: 433.3, w: 350, h: 53, font: 26.6 },
  hero: { x: 360, y: 833.6, w: 288, h: 288 },
  caption_bottom: { x: 360, y: 978.4, w: 720, h: 55.9, font: 53.3 },
  btn_retry: { x: 360, y: 1082.9, w: 633.6, h: 103.6, font: 40.3 },
  btn_rank: { x: 360, y: 1199.4, w: 633.6, h: 103.6, font: 40.3 },
} as const;
