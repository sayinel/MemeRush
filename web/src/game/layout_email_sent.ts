// 이메일: 보냄 layout (coordinates = the 720x1280 game frame 1:1; x,y = element CENTER; w,h = displayed size; font = px).
// Measured from the running game (DOM getBoundingClientRect). NOT read by game code yet: the game still uses its own CSS/Phaser
// values; this file only holds the same numbers for the layout editor (tools/layout-editor, apply_layout.mjs email_sent).
export const EMAIL_SENT_LAYOUT = {
  caption: { x: 342.67, y: 363.61, w: 511.98, h: 210.11, font: 47.5 },
  hero: { x: 360, y: 783.2, w: 331.2, h: 331.2 },
  btn_again: { x: 361.58, y: 1078.17, w: 633.6, h: 103.6, font: 40.3 },
  btn_rank: { x: 360, y: 1199.4, w: 633.6, h: 103.6, font: 40.3 },
} as const;
