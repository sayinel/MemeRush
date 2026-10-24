# 어드민 화면 작업 메모 (PROGRESS)

## 진행 기록
- [1단계] 규칙 문서와 시안(admin_flow_tpl.html) 읽음. `npm ci`로 기존 lockfile 그대로 설치(새 의존성 없음).
- [1단계] 설계: 서버 데이터 층(`src/app/admin/_lib/data.ts`), API 4개(state, pick, run, image), 화면 2개(`/admin`, `/admin/new`).
- [2단계] 구현 완료: `_lib`(types, week, data, guard), `_fixtures` 샘플 JSON 7개, API 4개, `/admin`, `/admin/new`, `admin.css`. `npm run lint` 통과. `tsc`의 RouteContext/PageProps/LayoutProps 오류는 기존 파일의 전역 타입이고 build가 타입을 만든 뒤 사라지는지 확인한다.
- [환경] 이 세션에서 Bash 쓰기가 중간에 거부되어 새 파일은 Edit 도구로 만들었다.
- [3단계] `ADMIN_LOCAL=1 next dev`로 라우트 점검(임시 스크립트, 점검 후 삭제) 35개 항목 모두 통과:
  - `/admin` 200, "샘플 자료" 칩, "비어 있음", 게임 등록 버튼 2개, 실제 발행 판(FRIDAY 5PM) 표시, 예약 칩
  - `/admin/new?fresh=1` 200
  - 선택 흐름(주제, 문구, 이미지 다시 요청, 이미지, 발행일)이 자동 단계 2.5초씩 거쳐 완료되고, 홈 목록에 새 예약이 들어감
  - 잘못된 값 400, 순서가 어긋난 선택 409, 이미 찬 날짜 409, 다른 Origin 403, 이미지 경로 이탈 404
  - `ADMIN_LOCAL` 없음: `/admin`, `/admin/new`, `/api/admin/*` 모두 404
- [3단계] 아직 못 본 것: 브라우저 화면(클라이언트 렌더, 360px/1280px 가로 스크롤, 확인 창 포커스·Esc). 헤드리스 브라우저가 이 환경에 없어 코드와 CSS로만 맞췄다. 사람이 한 번 눌러 봐야 한다.

## 가정과 남은 일 (실행기와 맞출 것)
- 화면 1단계는 `pick_topic`, 2단계는 `cards`로 본다. `research, pair, brief`는 1단계 앞 준비로 보고, 끝나기 전에는 1단계에서 로고만 보인다.
- `--copy N`은 1부터 센다. `--image`에는 `out/pipeline/images/<파일>` 경로를 넘긴다(이미지 후보는 그 폴더의 파일).
- 새 등록(`mode:new`)은 완료된 뒤에만 `pipeline --date <오늘> --out out/pipeline`을 실행한다(밈 이름은 아직 모르므로 생략). 실행기의 실제 인자와 다르면 `data.ts`의 `applyRun`만 고치면 된다.
- 이미지 다시 요청은 실행기에 명령이 없어 실제 모드에서는 `out/pipeline/reimage_request.json`만 남긴다. 샘플 모드에서는 이미지 제작 단계로 실제로 돌아간다.
- 후보 문구 파일(`card_candidates.json`, `card.json`)의 모양을 몰라서 `title/name/text`, `win/lose(top, bottom)`, `share`를 느슨하게 읽는다.
- 게시된 판(content/challenges)에는 후킹 이미지 필드가 없어 목록에서 "비어 있음"으로 보인다. 판 JSON에 `image`가 생기면 자동으로 쓴다.
- 폭 480px 이하에서 주 버튼을 가운데에 붙이라는 ADMIN_UX_GUIDE 6절과 사장님 지시(하단 CTA 오른쪽 정렬)가 달라서 사장님 지시를 따랐다.
- 발행 시각은 파일에 없어 날짜만 표시한다(시안의 09:00은 쓰지 않음).
- 파이프라인 실행기가 아직 없으면 `_fixtures/`의 샘플 JSON과, 서버 메모리의 모의 진행(자동 단계 2.5초)으로 화면이 실제로 돈다.
