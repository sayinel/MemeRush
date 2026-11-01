// 달고나 다음 편 예고 이메일 훅(dalgona_email_hook) layout (720x1280 1:1; x,y = element CENTER (anchor bottom = box bottom); w,h = displayed size; font = px). 시안 초안.
export const DALGONA_EMAIL_HOOK_LAYOUT = {
  btn_back: { x: 84, y: 46, w: 126, h: 55, font: 28 }, // 뒤로(결과 화면으로)
  caption_top: { x: 360, y: 150, w: 640, h: 90, font: 72 }, // 다음 편 번호(예고 제목)
  teaser_line: { x: 360, y: 250, w: 640, h: 56, font: 34 }, // 호기심 한 줄(문 뒤가 궁금하게)
  door: { x: 360, y: 560, w: 360, h: 420 }, // 잠긴 문(1편 문 재활용, 메일을 남기면 열림)
  hero_peek: { x: 170, y: 900, w: 260, h: 260 }, // 문 앞에서 덜덜 떠는 주인공
  reward_line: { x: 360, y: 820, w: 640, h: 80, font: 32 }, // 즉시 보상 한 줄(입력 직후 티저 공개)
  input: { x: 360, y: 965, w: 634, h: 86, font: 32 }, // 이메일 입력 칸
  btn_submit: { x: 360, y: 1075, w: 634, h: 104, font: 40 }, // 제출 버튼
  help: { x: 360, y: 1158, w: 634, h: 36, font: 24 }, // 약속 범위(매일 약속 안 함, 10/30 결정)
} as const;
