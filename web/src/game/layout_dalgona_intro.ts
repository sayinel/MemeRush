// 시작 화면(intro) layout (coordinates = the 720x1280 game frame 1:1; x,y = element CENTER; w,h = displayed size; font = px).
// Measured from the running game (DOM getBoundingClientRect). NOT read by game code yet: the game still uses its own CSS/Phaser
// values; this file only holds the same numbers for the layout editor (tools/layout-editor, apply_layout.mjs dalgona_intro).
export const DALGONA_INTRO_LAYOUT = {
  lang_toggle: { x: 629.7, y: 39.7, w: 121.2, h: 43.4, font: 20.2 },
  title: { x: 347.5, y: 240.1, w: 720, h: 83.2, font: 79.2 },
  subtitle: { x: 360, y: 333.3, w: 720, h: 55.9, font: 53.3 },
  description: { x: 350.6, y: 424, w: 433.39, h: 76.6, font: 27.4 },
  hero: { x: 245.2, y: 902.1, w: 418, h: 418 },
  btn_start: { x: 360, y: 1199.4, w: 633.6, h: 103.6, font: 40.3 },
} as const;
