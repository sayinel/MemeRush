// 2편 예고 배너 조립(banner_next_ep) layout (720x1280 1:1; x,y = element CENTER; w,h = displayed size; font = px). 바탕판(banner_plate) 중심이 배너의 원점이다.
export const BANNER_NEXT_EP_LAYOUT = {
  banner_plate: { x: 360, y: 640, w: 640, h: 170 }, // 배너 바탕판(남색+금색 테두리)
  banner_disc: { x: 230.41, y: 638.28, w: 138, h: 138 }, // 배너 안 달고나 판
  banner_hero: { x: 139.39, y: 661.28, w: 100, h: 100 }, // 배너 안 초록 운동복 주인공
  t_next: { x: 460, y: 598.65, w: 300, h: 60, font: 52 }, // 배너 큰 제목
  t_name: { x: 460, y: 648.2, w: 300, h: 44, font: 34 }, // 배너 게임 이름
  t_sub: { x: 460, y: 688, w: 293.07, h: 32, font: 22 }, // 배너 호기심 한 줄
} as const;
