import type { ScreenDef } from "./types";

// 2편 예고 훅 배너 조립판: 배너 한 장 안의 조각을 사장님이 직접 움직인다. 저장하면 render_banner.py가 이 값으로 banner_next_ep.png를 다시 만든다.
export const banner_next_ep: ScreenDef = {
  id: "banner_next_ep",
  label: "2편 예고 배너 조립(banner_next_ep)",
  bgCss: "linear-gradient(#bfe3ff, #8fc8f5)",
  elements: [
    {"name": "banner_plate", "kind": "image", "src": "banner_plate.png", "note": "배너 바탕판(남색+금색 테두리)"},
    {"name": "banner_disc", "kind": "image", "src": "dalgona_disc_umbrella.png", "note": "배너 안 달고나 판"},
    {"name": "banner_hero", "kind": "image", "src": "worker_oc_sweating.png", "note": "배너 안 초록 운동복 주인공"},
    {"name": "t_next", "kind": "text", "family": "sans", "weight": 900, "align": "left", "color": "#FEDE25", "text": "NEXT #002", "note": "배너 큰 제목"},
    {"name": "t_name", "kind": "text", "family": "sans", "weight": 800, "align": "left", "color": "#FFFFFF", "text": "달고나 뽑기 2탄", "note": "배너 게임 이름"},
    {"name": "t_sub", "kind": "text", "family": "sans", "weight": 600, "align": "left", "color": "#BED7FF", "text": "깨뜨리지 않고 따낼 수 있을까? ›", "note": "배너 호기심 한 줄"},
  ],
};
