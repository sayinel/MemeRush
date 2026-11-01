// 결과: TOO EARLY layout (coordinates = the 720x1280 game frame 1:1; x,y = element CENTER; w,h = displayed size; font = px).
// Measured from the running game (DOM getBoundingClientRect). NOT read by game code yet: the game still uses its own CSS/Phaser
// values; this file only holds the same numbers for the layout editor (tools/layout-editor, apply_layout.mjs result_early).
export const RESULT_EARLY_LAYOUT = {
  chip: { x: 97.9, y: 42.7, w: 152.6, h: 49.4, font: 25.9 },
  lang_toggle: { x: 637.8, y: 41.5, w: 121.2, h: 47, font: 23.8 },
  caption_top: { x: 360, y: 106.4, w: 720, h: 54.4, font: 51.8 },
  verdict: { x: 360, y: 239.4, w: 360.4, h: 90, font: 90 },
  score: { x: 360, y: 347.2, w: 447.81, h: 108, font: 108 },
  badge: { x: 360, y: 466.4, w: 350, h: 53, font: 26.6 },
  hero: { x: 355.3, y: 746.5, w: 288, h: 288 },
  duck: { x: 384.6, y: 630.1, w: 79, h: 79 }, // 추정: 흔들리는 애니메이션의 첫 프레임 기준
  btn_retry: { x: 360, y: 935, w: 633.6, h: 103.6, font: 40.3 },
  btn_rank: { x: 360, y: 1051, w: 633.6, h: 103.6, font: 40.3 },
  next_banner: { x: 360, y: 1190, w: 560, h: 149 }, // 2편 예고 훅 배너(누르면 다음 편 예고·이메일 훅 페이지가 열림)
} as const;
