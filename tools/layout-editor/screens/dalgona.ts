import type { ScreenDef } from "./types";

// 달고나 슈퍼포지션: 사장님이 요소를 끌어 장면을 조합한다(대기/위기/끌려감 팔레트). 좌표 정본은 web/src/game/layout_dalgona.ts.
export const dalgona: ScreenDef = {
  id: "dalgona",
  label: "달고나 무대(dalgona)",
  bg: "bg_dalgona_playground.webp",
  elements: [
    { name: "disc", kind: "image", src: "dalgona_disc_umbrella.png", note: "달고나 판(캔버스가 실제로는 이 자리)" },
    { name: "hero_ready", kind: "image", src: "worker_oc_sweating.png", note: "주연 대기: 판 왼쪽에서 덜덜" },
    { name: "hero_hot", kind: "image", src: "worker_oc_shocked.png", note: "주연 위기(마지막 3초) 변형" },
    { name: "hero_clear", kind: "image", src: "worker_oc_laughing.png", note: "주연 성공 변형" },
    { name: "support_ready", kind: "image", src: "assistant_stand.png", note: "조연 대기: 조교" },
    { name: "support_hot", kind: "image", src: "frontman_peek.png", note: "조연 위기: 프론트맨 엿봄" },
    { name: "support_extra", kind: "image", src: "assistant_whistle.png", note: "조연 변형(휘파람)" },
    { name: "boss_walk", kind: "image", src: "boss_walk.png", note: "사장 등장(끌려가기 직전)" },
    { name: "drag_combo", kind: "image", src: "drag_combo.png", note: "끌려가기 컷(사장이 주연을 끌고 감)" },
    { name: "prop_clock", kind: "image", src: "clock_button.png", note: "소품 예: 시계 버튼" },
  ],
};
