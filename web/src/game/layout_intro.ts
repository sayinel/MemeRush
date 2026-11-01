// 시작 화면(intro) layout (coordinates = the 720x1280 game frame 1:1; x,y = element CENTER; w,h = displayed size; font = px).
// Measured from the running game (DOM getBoundingClientRect). NOT read by game code yet: the game still uses its own CSS/Phaser
// values; this file only holds the same numbers for the layout editor (tools/layout-editor, apply_layout.mjs intro).
export const INTRO_LAYOUT = {
  lang_toggle: { x: 637.8, y: 39.7, w: 121.2, h: 43.4, font: 20.2 },
  title: { x: 344.2, y: 186.8, w: 720, h: 83.2, font: 79.2 },
  subtitle: { x: 360, y: 267, w: 720, h: 55.9, font: 53.3 },
  description: { x: 347.4, y: 344.8, w: 604.8, h: 76.6, font: 27.4 },
  hero: { x: 360, y: 855.2, w: 418, h: 418 },
  btn_start: { x: 360, y: 1199.4, w: 633.6, h: 103.6, font: 40.3 },
  next_banner: { x: 360, y: 1190, w: 560, h: 149 }, // 2편 예고 훅 배너(누르면 다음 편 예고·이메일 훅 페이지가 열림)
} as const;
