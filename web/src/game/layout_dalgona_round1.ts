// Round 1 start screen layout, ONE place to edit. Game coordinates = the 720x1280 Figma frame 1:1
// (Figma file UNHSzs4V8N9bkxjNCVQQQC, frame 1:2; values below are centers = Figma x + w/2, y + h/2).
// font = px size on the 720x1280 canvas. hero.y is the BOTTOM edge of the 380x380 hero box (not its feet line).
export const DALGONA_ROUND1_LAYOUT = {
  badge_round: { x: 118, y: 52, w: 196, h: 48, font: 26 }, // "ROUND 1/3" chip (Figma 20,28)
  caption_top: { x: 357.71, y: 170, w: 560.56, h: 84, font: 56 }, // round name, one line
  prompt_text: { x: 360, y: 262, w: 640, h: 78, font: 26 }, // meme.prompt, two lines max, round 1 only
  star_left: { x: 100.5, y: 337.5, w: 77, h: 77 },
  star_right: { x: 620.5, y: 337.5, w: 77, h: 77 },
  clock_panel: { x: 363, y: 473, w: 774, h: 272 }, // panel art; may run past the screen edge on purpose
  clock_digits: { x: 362.29, y: 468.43, w: 490, h: 178, font: 90 }, // 슈퍼포지션 저장(10/30 23:08)
  ribbon: { x: 498, y: 730, w: 440, h: 138 }, // resting place after the slide-in
  ribbon_label: { x: 501.5, y: 711, w: 169, h: 66, font: 44 }, // "GET READY"
  hero: { x: 212.29, y: 966.84, w: 380, h: 380 },
  button: { x: 498, y: 869, w: 276, h: 182 },
  tap_at: { x: 360, y: 1075, w: 470, h: 120, font: 80 }, // line under hero and button during a round
} as const;
