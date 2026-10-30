// 이메일: 저장 실패 layout (coordinates = the 720x1280 game frame 1:1; x,y = element CENTER; w,h = displayed size; font = px).
// Measured from the running game (DOM getBoundingClientRect). NOT read by game code yet: the game still uses its own CSS/Phaser
// values; this file only holds the same numbers for the layout editor (tools/layout-editor, apply_layout.mjs email_failed).
export const EMAIL_FAILED_LAYOUT = {
  btn_back: { x: 84.6, y: 45.5, w: 125.9, h: 54.9, font: 28.8 },
  title: { x: 360, y: 96.5, w: 720, h: 63.5, font: 60.5 },
  hero: { x: 360, y: 655.6, w: 316.8, h: 316.8 },
  error_line: { x: 360, y: 875.2, w: 633.6, h: 64.8, font: 25.2 },
  input: { x: 360, y: 965.2, w: 633.6, h: 86.4, font: 31.7 },
  btn_submit: { x: 360, y: 1074.6, w: 633.6, h: 103.6, font: 40.3 },
  help: { x: 360, y: 1158, w: 633.6, h: 34.5, font: 23.8 },
} as const;
