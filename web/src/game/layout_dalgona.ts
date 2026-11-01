// 달고나 무대(dalgona) layout (720x1280 1:1; x,y = element CENTER; w,h = displayed size). 슈퍼포지션 초안: 사장님이 편집기에서 조합한다.
export const DALGONA_LAYOUT = {
  disc: { x: 360, y: 640, w: 420, h: 420 }, // 달고나 판(캔버스가 실제로는 이 자리)
  hero_ready: { x: 170, y: 1010, w: 330, h: 330 }, // 주연 대기: 판 왼쪽에서 덜덜
  hero_hot: { x: 170, y: 560, w: 300, h: 300 }, // 주연 위기(마지막 3초) 변형
  hero_clear: { x: 170, y: 230, w: 300, h: 300 }, // 주연 성공 변형
  support_ready: { x: 560, y: 1010, w: 300, h: 300 }, // 조연 대기: 조교
  support_hot: { x: 560, y: 560, w: 300, h: 300 }, // 조연 위기: 프론트맨 엿봄
  support_extra: { x: 560, y: 230, w: 300, h: 300 }, // 조연 변형(휘파람)
  boss_walk: { x: 360, y: 1180, w: 260, h: 300 }, // 사장 등장(끌려가기 직전)
  drag_combo: { x: 360, y: 120, w: 420, h: 350 }, // 끌려가기 컷(사장이 주연을 끌고 감)
  prop_clock: { x: 600, y: 120, w: 160, h: 106 }, // 소품 예: 시계 버튼
} as const;
