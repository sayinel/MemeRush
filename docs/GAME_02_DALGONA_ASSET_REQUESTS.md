# 밈러시 #002 달고나: 에셋 요청 목록 (2026-11-01, 핏)

근거: `GAME_02_DALGONA_SCRIPT.md` 6장, `GAME_SCREEN_GUIDE.md`(챔피언 밈: 두꺼운 흰 테두리와 갈색 윤곽, 글자는 그림에 굽지 않음, 구석 표시 지움, 스프라이트는 투명 PNG 100KB 안팎·2배 해상도, 배경은 WebP 720x1280 이상 200KB 이하). 라이브러리 먼저 조회한 결과만 신규로 요청한다(`ASSET_LIBRARY.md`, `asset_index.json`).

## 재사용(신규 제작 없음)

- 주인공 표정: `worker_sweating`, `worker_shocked`, `worker_proud`, `worker_crying`, `worker_deadpan`
- 보스: `boss_walk`, `boss_grab` 계열(들여다보는 컷에는 `boss_walk` 사용)
- 소품: `trophy`, `poof`, `confetti_star`는 색종이 없음 규칙 때문에 별 터짐 용도로만

## 신규 요청

키 이름은 `asset_index.json`·`manifest.json`과 같은 snake_case를 쓴다.

- `bg_dalgona_stall` — 배경(WebP). 골목 달고나 노점. 가운데는 판이 놓일 빈 자리, 구석 표시 없음.
- `dalgona_disc` — 스프라이트(투명 PNG). 갈색 달고나 원판, 앞면만. 두꺼운 흰 테두리.
- `shape_circle_outline` — 스프라이트(투명 PNG). 판 위에 찍힌 원 테두리 홈. 얇지 않게(손가락이 따라갈 굵기).
- `shape_triangle_outline` — 같은 규격, 삼각형.
- `shape_star_outline` — 같은 규격, 별.
- `crack_overlay_1` — 투명 PNG. 판 전체에 얇은 금 한두 줄.
- `crack_overlay_2` — 투명 PNG. 금이 길게 퍼진 모양.
- `needle_tool` — 투명 PNG. 바늘, 손끝 아이콘.
- `dalgona_shards` — 투명 PNG. 쪼개진 판 조각 3~4개(깨짐 연출).
- `result_dalgona_perfect_bg`, `result_dalgona_fail_bg` — 결과 배경(WebP). 성공은 판이 깨끗이 떨어진 컷, 실패는 쪼개진 판과 보스 그림자.
- `og_dalgona_base` — OG 기본(PNG 1200x630). 왼쪽 1/3은 로고 자리.

## 만드는 방법과 주의

- 제작은 그림 도구(나노바나나 우선, Vertex는 유료 지시 때만)로 하고, 완성되면 `manifest.json`에 키를 추가해 색인을 다시 돌린다(`python tools/asset_index.py --episode mr-002`).
- 오징어 게임의 그림·로고·소리와 우산 모양은 쓰지 않는다. 별·원·삼각형 같은 일반 도형만 쓴다.
- 반복 생성은 사람 빈도로 한다(자동 폭주 금지).

## 소리 후보 (회사 효과음 라이브러리에서 복사해 둠)

위치: `C:/work/_ops/sfx_candidates/dalgona_2편/`(원본은 `D:\library`, 라벨 정확도 약 50%라 직접 듣고 고른다).
- 깨지는 소리 후보: `ep13-newapt-avoidance__scene_23__1`(2.5초), `ep15-floor-noise-mat__씬04__1`(3.3초), `ep35-cctv-elevator__씬06__2`(1.0초)
- 갈라지는 소리 후보: `ep13-newapt-avoidance__scene_32__1`(2.9초), `lf05-trip-home-accident__씬17__1`(1.1초)
- 고른 것은 `asset_index.json`에 `source: library:sfx#<id>`, `episodes: ["mr-002"]`로 올린다.

## 확정된 색과 완성 에셋 (사장님 2026-11-01)

- 달고나 색의 기준은 윤기 나는 캐러멜 갈색이다(대표 값 `#c87c2e`, 홈 선은 짙은 갈색). 쇠통 뚜껑에 담은 연한 살구·베이지 시트는 "너무 살구색"이라 쓰지 않는다.
- 완성: `dalgona_disc_heart`, `dalgona_disc_star`, `dalgona_disc_umbrella`(투명 PNG, 하트·별·우산 홈이 찍힌 원판). 캐릭터는 주인공(`worker_tg_*`), 사장(`frontman_*`), 조교(`assistant_*`).
- 남은 것: 구름 놀이터 배경(후보 시트 있음, 선택 대기), 금·조각·폭탄 효과, 결과 배경, OG 이미지, 바늘.
