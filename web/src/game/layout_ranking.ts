// 랭킹 layout (coordinates = the 720x1280 game frame 1:1; x,y = element CENTER; w,h = displayed size; font = px).
// Measured from the running game (DOM getBoundingClientRect). NOT read by game code yet: the game still uses its own CSS/Phaser
// values; this file only holds the same numbers for the layout editor (tools/layout-editor, apply_layout.mjs ranking).
export const RANKING_LAYOUT = {
  panel: { x: 360, y: 640, w: 720, h: 1280 },
  btn_back: { x: 127.2, y: 48.7, w: 198.64, h: 54.9, font: 28.8 },
  lang_toggle: { x: 642.8, y: 41.5, w: 121.2, h: 47, font: 23.8 },
  trophy: { x: 186.6, y: 167.9, w: 64.8, h: 64.8 },
  title: { x: 394.7, y: 167.9, w: 648, h: 64.8, font: 54.7 },
  row1: { x: 363.2, y: 254.5, w: 648, h: 64.1 },
  row1_rank: { x: 78.8, y: 254.5, w: 36, h: 41, font: 27.4 },
  row1_name: { x: 339.5, y: 254.5, w: 456.7, h: 41, font: 27.4 },
  row1_time: { x: 623.9, y: 254.5, w: 83.3, h: 41, font: 27.4 },
  row2: { x: 363.2, y: 328.6, w: 648, h: 64.1 },
  row2_rank: { x: 78.8, y: 328.6, w: 36, h: 41, font: 27.4 },
  row2_name: { x: 339.5, y: 328.6, w: 456.7, h: 41, font: 27.4 },
  row2_time: { x: 623.9, y: 328.6, w: 83.3, h: 41, font: 27.4 },
  row3: { x: 363.2, y: 402.7, w: 648, h: 64.1 },
  row3_rank: { x: 78.8, y: 402.7, w: 36, h: 41, font: 27.4 },
  row3_name: { x: 339.5, y: 402.7, w: 456.7, h: 41, font: 27.4 },
  row3_time: { x: 623.9, y: 402.7, w: 83.3, h: 41, font: 27.4 },
  row4: { x: 363.2, y: 476.9, w: 648, h: 64.1 },
  row4_rank: { x: 78.8, y: 476.9, w: 36, h: 41, font: 27.4 },
  row4_name: { x: 339.5, y: 476.9, w: 456.7, h: 41, font: 27.4 },
  row4_time: { x: 623.9, y: 476.9, w: 83.3, h: 41, font: 27.4 },
  row5: { x: 363.2, y: 551, w: 648, h: 64.1 },
  row5_rank: { x: 78.8, y: 551, w: 36, h: 41, font: 27.4 },
  row5_name: { x: 339.5, y: 551, w: 456.7, h: 41, font: 27.4 },
  row5_time: { x: 623.9, y: 551, w: 83.3, h: 41, font: 27.4 },
  help: { x: 342.6, y: 1022.8, w: 509.1, h: 34.5, font: 23.8 },
  btn_email: { x: 360, y: 933.4, w: 648, h: 103.6, font: 40.3 },
  btn_share: { x: 360, y: 815.8, w: 648, h: 103.15, font: 34.6 },
  next_banner: { x: 347.4, y: 1165, w: 550, h: 149 }, // 2편 예고 훅 배너(누르면 다음 편 예고·이메일 훅 페이지가 열림)
} as const;
