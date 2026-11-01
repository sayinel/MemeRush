import type { ScreenDef } from "./types";

// 달고나 다음 편 예고 이메일 훅(시안): 잠긴 문 + 즉시 보상. 사장님이 위치·문구를 조합판에서 맞춘다. 좌표 정본은 web/src/game/layout_dalgona_email_hook.ts.
export const dalgona_email_hook: ScreenDef = {
  id: "dalgona_email_hook",
  label: "달고나 다음 편 예고 이메일 훅(시안)",
  bg: "bg_dalgona_playground.webp",
  elements: [
    {"name": "btn_back", "kind": "text", "family": "sans", "weight": 700, "align": "center", "color": "#FFFFFF", "stroke": 6, "strokeColor": "#14192E", "text": "‹ 순위", "note": "뒤로(결과 화면으로)"},
    {"name": "caption_top", "kind": "text", "family": "anton", "weight": 400, "align": "center", "color": "#FFFFFF", "stroke": 12, "strokeColor": "#14192E", "text": "NEXT [[#003]]", "note": "다음 편 번호(예고 제목)"},
    {"name": "teaser_line", "kind": "text", "family": "sans", "weight": 700, "align": "center", "color": "#FFFFFF", "stroke": 8, "strokeColor": "#14192E", "text": "주인공이 달고나 앞에 섰다…", "note": "호기심 한 줄(문 뒤가 궁금하게)"},
    {"name": "door", "kind": "image", "src": "dalgona_disc_umbrella.png", "note": "진짜 달고나(오징어게임 연상, 호기심의 시작)"},
    {"name": "hero_peek", "kind": "image", "src": "worker_oc_sweating.png", "anchor": "bottom", "note": "달고나 앞에서 덜덜 떠는 초록 운동복 주인공"},
    {"name": "reward_line", "kind": "text", "family": "sans", "weight": 700, "align": "center", "color": "#FEDE25", "stroke": 8, "strokeColor": "#14192E", "text": "깨뜨리지 않고 따낼 수 있을까?", "note": "훅 한 줄(입력 직후 달고나 티저 1컷 공개)"},
    {"name": "input", "kind": "box", "family": "sans", "weight": 700, "align": "left", "color": "#9aa3b2", "fill": "#FFFFFF", "border": "#14192E", "borderW": 4, "radius": 18, "text": "이메일 주소", "note": "이메일 입력 칸"},
    {"name": "btn_submit", "kind": "box", "family": "sans", "weight": 900, "align": "center", "color": "#FFFFFF", "stroke": 0, "fill": "#12803c", "border": "#FFFFFF", "borderW": 4, "radius": 22, "text": "다음 게임 메일로 받기", "note": "제출 버튼"},
    {"name": "help", "kind": "text", "family": "sans", "weight": 500, "align": "center", "color": "#FFFFFF", "stroke": 5, "strokeColor": "#14192E", "text": "이메일을 남기면 이 게임과 새 게임 소식을 메일로 보내 드려요.", "note": "사장님 확정 동의 문구(10/30, 이것만 넣는다)"},
  ],
};
