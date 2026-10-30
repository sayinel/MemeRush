// 이메일: 주소 오류 layout (coordinates = the 720x1280 game frame 1:1; x,y = element CENTER; w,h = displayed size; font = px).
// Measured from the running game (DOM getBoundingClientRect). NOT read by game code yet: the game still uses its own CSS/Phaser
// values; this file only holds the same numbers for the layout editor (tools/layout-editor, apply_layout.mjs email_invalid).
export const EMAIL_INVALID_LAYOUT = {
  btn_back: { x: 84.6, y: 45.5, w: 125.9, h: 54.9, font: 28.8 },
  title: { x: 360, y: 96.5, w: 720, h: 63.5, font: 60.5 },
  subtitle: { x: 360, y: 163.6, w: 720, h: 39.3, font: 37.4 },
  hero: { x: 360, y: 655.6, w: 316.8, h: 316.8 },
  paper_pile: { x: 162, y: 752.8, w: 138.2, h: 138.2 }, // 추정: 기울어진 이미지의 레이아웃 박스 기준
  error_line: { x: 360, y: 875.2, w: 633.6, h: 64.8, font: 25.2 },
  input: { x: 360, y: 965.2, w: 633.6, h: 86.4, font: 31.7 },
  btn_submit: { x: 360, y: 1074.6, w: 633.6, h: 103.6, font: 40.3 },
  help: { x: 360, y: 1158, w: 633.6, h: 34.5, font: 23.8 },
  legal: { x: 360, y: 1216.8, w: 633.6, h: 54.4, font: 19.4 },
} as const;
