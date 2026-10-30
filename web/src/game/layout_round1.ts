// Round 1 start screen layout, ONE place to edit. Game coordinates = the 720x1280 Figma frame 1:1.
// x,y = element center (the hero's y is its feet line, origin bottom-centre); w,h = displayed size.
// Figma file UNHSzs4V8N9bkxjNCVQQQC: copy the values here and nothing else needs to change.
export const ROUND1_LAYOUT = {
  badge_round: { x: 118, y: 52, w: 196, h: 48 }, // "ROUND 1/3" chip
  caption_top: { x: 360, y: 170, w: 664, h: 64 }, // round name, one line (font size shrinks to fit w)
  prompt_text: { x: 360, y: 262, w: 640, h: 70 }, // meme.prompt, two lines max, only in round 1
  star_left: { x: 360 - 260, y: 470 - 125 - 8, w: 77, h: 77 }, // above the clock frame corner
  star_right: { x: 360 + 260, y: 470 - 125 - 8, w: 77, h: 77 },
  clock: { x: 360, y: 470, w: 560, h: 190 }, // digits box; the panel art is 80 wider and 60 taller
  ribbon: { x: 525, y: 700, w: 378, h: 119 }, // resting place after the slide-in (scaled 0.7)
  hero: { x: 200, y: 955, w: 380, h: 380 }, // y = feet line
  button: { x: 488, y: 950, w: 182, h: 120 },
  tap_at: { x: 360, y: 1075, w: 664, h: 80 }, // line under hero and button during a round
} as const;
