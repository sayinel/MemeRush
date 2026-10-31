# 밈러시 에셋·틀 라이브러리 (2026-11-01 초안)

사장님 2026-11-01: 게임 틀, 이미지, 소리를 라이브러리로 쌓는다. 대본이 완성되면 라이브러리에서 조합하고, 빈자리는 새로 만들어 채운 뒤 재활용 후보로 넣는다. 슈퍼라이브러리(탐 프로젝트)에 합쳐서 올리고, 밈러시 에피소드 태깅으로도 따로 찾을 수 있어야 한다.

## 세 가지 라이브러리

- 틀: `docs/GAME_FRAME_SPEC.md`의 틀 라이브러리(6종 설계, `timing_stop` 하나만 구현).
- 이미지: `web/public/game/manifest.json`(키 이름과 파일). 새 그림은 `asset_requests.json`에서 라이브러리에 없는 키만 요청한다.
- 소리: `web/public/sfx`. 새 소리를 만들기 전에 회사 효과음 라이브러리(`D:\library`, DB `library.db`의 `sfx` 표, 791개, 라벨 정확도 약 50%라 직접 듣고 고른다)를 먼저 검색한다.

## 색인

`python tools/asset_index.py`가 `docs/asset_index.json`을 만든다. 항목 한 줄에 `id`, `kind`(image·sfx·bgm·frame), `file`, `tags`, `episodes`(밈러시 에피소드 번호, 기본 `mr-001`), `source`(새로 만듦·출처), `reuse`(재활용 후보)가 있다.

## 에피소드 태깅 규칙

- 새 판을 만들 때 쓴 에셋의 `episodes`에 그 판 번호(예: `mr-002`)를 추가한다.
- 새로 만든 에셋은 `source: new`, 회사 라이브러리에서 가져온 것은 `source: library:sfx#<id>`로 쓴다.
- 쓰고 남은 것은 `reuse: candidate`로 둔다. 다음 판 조합 때 이 후보부터 찾는다.
- 에피소드별로 찾으려면 `episodes`에서 번호로 거른다. 슈퍼라이브러리 쪽에서는 `kind`와 `tags`로 찾는다.

## 한계

- 이미지·소리의 분위기·밈 태그는 이름에서 뽑은 최소 태그다. 사람이 다듬어야 한다.
- 소리의 출처 칸은 `web/public/sfx/SOURCES.md`를 가리킬 뿐 항목별로 풀지 않았다.
