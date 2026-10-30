// 플레이 중(play) layout (coordinates = the 720x1280 game frame 1:1; x,y = element CENTER; w,h = displayed size; font = px).
// Measured from the running game (DOM getBoundingClientRect). NOT read by game code yet: the game still uses its own CSS/Phaser
// values; this file only holds the same numbers for the layout editor (tools/layout-editor, apply_layout.mjs play).
export const PLAY_LAYOUT = {
  clock_panel: { x: 363, y: 473, w: 774, h: 272 },
  star_left: { x: 100.5, y: 337.5, w: 77, h: 77 },
  star_right: { x: 620.5, y: 337.5, w: 77, h: 77 },
  clock_digits: { x: 360, y: 486, w: 490, h: 178, font: 90 }, // 플레이 중에는 아래 hider가 가린다
  hider: { x: 363, y: 473, w: 620, h: 280 }, // 라운드 1의 가림막(meeting_card). 코드: 620x280, 시계 중심에 4도 기울어 내려앉음 (각도는 편집기에서 못 만짐)
  button: { x: 498, y: 869, w: 276, h: 182 },
  hero: { x: 210, y: 989, w: 380, h: 380 }, // y = 박스 아래 끝(layout_round1.hero와 같은 뜻)
  badge_round: { x: 118, y: 52, w: 196, h: 48, font: 26 },
  caption_top: { x: 360, y: 170, w: 530, h: 84, font: 56 },
  tap_at: { x: 360, y: 1075, w: 470, h: 120, font: 80 },
} as const;
