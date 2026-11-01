// 결과: TOO EARLY layout (coordinates = the 720x1280 game frame 1:1; x,y = element CENTER; w,h = displayed size; font = px).
// Measured from the running game (DOM getBoundingClientRect). NOT read by game code yet: the game still uses its own CSS/Phaser
// values; this file only holds the same numbers for the layout editor (tools/layout-editor, apply_layout.mjs dalgona_result_early).
export const DALGONA_RESULT_EARLY_LAYOUT = {
  chip: { x: 97.9, y: 42.7, w: 152.6, h: 49.4, font: 25.9 },
  lang_toggle: { x: 637.8, y: 41.5, w: 121.2, h: 47, font: 23.8 },
  caption_top: { x: 360, y: 106.4, w: 720, h: 54.4, font: 51.8 },
  verdict: { x: 360, y: 239.4, w: 360.4, h: 90, font: 90 },
  score: { x: 361.58, y: 347.18, w: 447.81, h: 108, font: 108 },
  badge: { x: 358.42, y: 466.39, w: 350, h: 53, font: 26.6 },
  hero: { x: 355.27, y: 814.69, w: 288, h: 288 },
  duck: { x: 384.59, y: 703.37, w: 79, h: 79 }, // 추정: 흔들리는 애니메이션의 첫 프레임 기준
  caption_bottom: { x: 360, y: 978.4, w: 720, h: 55.9, font: 53.3 },
  btn_retry: { x: 360, y: 1082.9, w: 633.6, h: 103.6, font: 40.3 },
  btn_rank: { x: 360, y: 1199.4, w: 633.6, h: 103.6, font: 40.3 },
} as const;
