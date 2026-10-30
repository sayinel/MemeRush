import { GOLD, type ScreenDef } from "./types";

// Round 1 start screen. Order = stacking order (last = on top). Initial x/y/w/h/font come from
// web/src/game/layout_round1.ts; out/layout_round1.json wins when it exists.
export const round1: ScreenDef = {
  id: "round1",
  label: "1라운드 시작",
  bg: "bg_office.webp",
  elements: [
    { name: "clock_panel", kind: "image", src: "timer_panel.png" },
    { name: "star_left", kind: "image", src: "confetti_star.png" },
    { name: "star_right", kind: "image", src: "confetti_star.png" },
    { name: "ribbon", kind: "image", src: "banner_gold.png" },
    { name: "button", kind: "image", src: "clock_button.png" },
    { name: "hero", kind: "image", src: "worker_deadpan.png", anchor: "bottom" },
    { name: "badge_round", kind: "text", text: "ROUND 1/3", color: "#FFFFFF", stroke: 6, bg: "pill" },
    { name: "caption_top", kind: "text", text: "TAKE 1: COZY SLIPPERS ON", color: "#FFFFFF", stroke: 14 },
    { name: "prompt_text", kind: "text", text: "Film the toaster and stop the clip the instant the toast jumps.", color: "#FFFFFF", stroke: 6 },
    { name: "clock_digits", kind: "text", text: "6:59:55.00", color: GOLD, stroke: 10 },
    { name: "ribbon_label", kind: "text", text: "GET READY", color: "#FFFFFF", stroke: 8 },
    { name: "tap_at", kind: "text", text: "TAP AT 7:00:00", color: "#FFFFFF", stroke: 14 },
  ],
};
