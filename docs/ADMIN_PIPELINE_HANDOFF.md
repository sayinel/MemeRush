# 어드민과 파이프라인 인수인계, 협의 사항 (2026-10-24 17:50)

탐이 어드민 화면과 파이프라인 실행기를 만들어 동작시키면, 동훈 님과 inelia 팀이 그것을 바탕으로 "게임 자동 생성" 과정([AUTO_GAME_GENERATION_SCENARIO.md](AUTO_GAME_GENERATION_SCENARIO.md))을 이어 가기로 했습니다. 이 문서는 넘기는 것, 넘기는 방법, 그리고 같이 정해야 할 것을 한곳에 모았습니다. 정해야 할 항목마다 탐의 추천을 적었으니 동의하면 "추천대로"라고만 답해도 됩니다.

## 1. 지금 상태 (10/24 17:50)

- 어드민 화면: 탐 로컬 커밋 있음(`web/src/app/admin/`, API 4개). 빌드와 점검 통과, 로컬 구동으로 홈(요일별 발행·예약)과 게임 등록 7단계, 주제 추천 5를 화면으로 확인했습니다. 깃허브에는 아직 없습니다.
- 파이프라인 실행기: 탐 로컬 커밋 있음(`tools/discovery`: `pipeline`, `topics`, `pipeline-status`, `pick`). 시험 267개가 3.11과 3.9에서 통과했습니다. 달고나 조사 글로 research, pair, brief 단계가 실제로 끝났습니다. 깃허브에는 아직 없습니다.
- 둘이 맞물려 끝까지 도는 것은 아직 확인하지 못했습니다. 이 확인이 오늘의 다음 일입니다.

## 2. 누가 무엇을 맡나

- 탐: 어드민 화면, 파이프라인 실행기, 주제 추천, 조사 읽기와 저장, 두 곳의 맞물림 확인, 시연 대본.
- 동훈 님과 inelia: 기존 `brief`, `card`, `assets`, `publish`(PR #37)를 어드민 흐름에 맞게 다듬기, 하루 판 저장 뒤 자동 시험과 배포 확인, 시연 노트북 준비.
- 핏: 에셋 제작과 후킹 이미지.
- 사장님: 주제, 문구, 이미지, 발행일 선택과 시연.

## 3. 어드민이 파이프라인과 주고받는 파일 (현재 가정)

- 읽는 것: `out/pipeline/topics.json`(주제 5), `status.json`(단계 상태), `registered.json`(예약 목록), `card_candidates.json` 또는 `card.json`(문구 후보), `asset_requests.json`, `web/content/challenges/*.json`(발행된 판).
- 쓰는 것: `picks.json`(주제, 문구, 이미지, 발행일). `python -m discovery pick ...`을 서버가 실행합니다.
- 안전장치: 어드민 화면과 `/api/admin/*`는 `ADMIN_LOCAL=1`일 때만 열리고 아니면 404입니다. 명령 인자는 허용 목록으로 검증합니다.

## 4. 같이 정해야 할 것 (탐 추천 포함)

1. **예약 목록에 한 줄을 추가하는 주체**: `publish`가 하는지 `pipeline`이 하는지. 추천: `pipeline`이 `publish`를 호출한 뒤 한 번만 추가(중복 방지).
2. **하루 판 JSON에 후킹 이미지와 발행 시각 필드 추가**: 지금은 판 JSON에 이미지 경로와 시각이 없어 어드민 목록에서 발행된 판이 "비어 있음"으로 보입니다. 추천: `hookImage`(경로)와 `publishAt`(ISO 시각)을 선택 필드로 추가하고 `challengeSchema`에 반영.
3. **문구 후보 파일 모양**: 어드민이 `title`, 성공·실패 `top`/`bottom`, `share`를 느슨하게 읽고 있습니다. 추천: `card_candidates.json`을 `[{id, title, win, lose, share, flags}]`로 고정.
4. **에셋 키 이름 규칙**: `asset_requests.json`의 키와 `manifest.json` 키가 같은 이름을 쓰는지. 추천: `manifest.json`을 정본으로 하고 요청 목록은 같은 키를 씁니다.
5. **이미지 후보를 두는 곳**: 추천 `out/pipeline/images/`에 후킹 이미지 후보(1200x630)를 두고 어드민이 그 폴더를 읽습니다. 확정하면 `web/public/game/`로 옮깁니다.
6. **카드 번호 기준**: 어드민이 `--copy N`을 1부터 센다고 가정했습니다. `card` 명령의 후보 번호와 같은지 확인이 필요합니다.
7. **시연 노트북 준비**: 파이썬, `uv`, `ANTHROPIC_API_KEY`(환경 변수, 값은 저장소에 두지 않음)가 있는지와 사전 점검 시각. 추천: 시연 3시간 전 한 번 끝까지 실행.
8. **배포 연결 범위(오늘)**: 어드민이 자동으로 PR을 만들지 않고, 배포는 사람이 PR을 병합하는 것으로 둡니다. 자동 병합은 L2 이후.
9. **새 틀(L2) 인터페이스**: `challengeSchema`가 `timing_stop` 하나로 고정돼 있어 다음 틀을 넣으려면 스키마의 틀 부분을 합집합으로 바꿔야 합니다. 오늘 범위 밖이지만 시기를 정해 두면 좋겠습니다.

## 5. 동훈 님 노트북에서 켜는 방법 (초안, 코드가 올라간 뒤 확정)

```text
cd web
ADMIN_LOCAL=1 npm run dev        # 어드민: http://localhost:3000/admin
cd tools/discovery
uv run --python 3.11 --with httpx --with anthropic python -m discovery topics --top 5 --out out/pipeline/topics.json
uv run --python 3.11 --with httpx --with anthropic python -m discovery pipeline --meme "<밈 이름>" --date <날짜> --out out/pipeline --research-file <조사 글>
```

- 조사 글은 탐이 미리 만들어 파일로 건넵니다(시연 노트북에서는 조사 호출을 하지 않음).
- Claude 호출은 그 노트북의 `ANTHROPIC_API_KEY`로 실행합니다.

## 6. 오늘의 순서 제안

1. 탐: 어드민과 파이프라인 PR 올리기(승인 후), 두 곳을 맞물려 끝까지 한 번 돌리기.
2. 동훈 님: 위 4절의 1~6번에 의견 남기기(이 PR에 댓글).
3. 탐과 동훈 님: 합의한 필드 변경을 각자 반영.
4. 시연 노트북 사전 점검(7번), 대본 연습.

## 7. 모르는 것

- 동훈 님 노트북 환경(파이썬, 키, 포트)은 미확인입니다.
- 어드민 단계 전환과 확인 창의 포커스·모바일 모양은 실제 기기에서 확인하지 못했습니다.
- 달고나 같은 소재는 가장 잘 맞는 틀(외곽선 따라가기)이 아직 지원되지 않아 오늘은 스톱워치 틀에 입힙니다.
