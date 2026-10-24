---
name: MEME_RUSH_SCREEN_GUIDE
colors:
  sky: "#3EAEF5"
  sky-light: "#80E3FE"
  panel: "#4CC0F7"
  row: "#A3E8FA"
  navy: "#1C5692"
  ink-blue: "#0F3A73"
  text-blue: "#245887"
  gold: "#FEDE25"
  hot: "#FFC531"
  bronze: "#F49E57"
  silver: "#D8DFEA"
  green: "#17803F"
  red: "#C93A52"
  lime: "#7AE83A"
  warn-text: "#7A5200"
  warn-bg: "#FFF1CF"
  outline-white: "#FFFFFF"
  mascot: "#EC8323"
  mascot-line: "#804526"
  caption-line: "#000000"
typography:
  title: {fontSize: 28px, fontWeight: 400, lineHeight: 1.2}
  score: {fontSize: 22px, fontWeight: 400, lineHeight: 1.1}
  body: {fontSize: 14px, fontWeight: 500, lineHeight: 1.5}
  caption: {fontSize: 12px, fontWeight: 700, lineHeight: 1.4}
spacing:
  2: 8px
  3: 12px
  4: 16px
rounded:
  md: 14px
  lg: 22px
---

# Meme Rush 서비스 화면 가이드

이 가이드는 Meme Rush의 서비스 화면(랭킹, 오늘의 게임 후보 관리, 결과, 공유 카드의 틀, 버튼, 확인 창, 안내 문구)을 정한다. 게임 안의 그림(캐릭터, 배경, 효과, 소리)은 핏이 만든 게임 화면 가이드(`MEME_RUSH_GAME_GUIDE`, 저장소 `docs/GAME_SCREEN_GUIDE.md`)가 정하고, 이 가이드는 그 위에 얹히는 화면 틀과 규칙만 다룬다. 색은 사장님이 준 젤리 리더보드 참고 이미지에서 픽셀로 뽑았다.

## 1. 범위: 서비스 화면과 게임 안 그림을 나눈다

규칙: 서비스 화면은 이 가이드를 따르고, 게임 안 그림은 게임 가이드를 따른다. 두 가이드가 부딪히면 게임 안에서는 게임 가이드가, 게임 밖 화면에서는 이 가이드가 이긴다.
적용: Meme Rush의 모든 화면.
값:
```text
서비스 화면(이 가이드)   랭킹(Global·Friends), 결과 화면, 후보 관리 화면, 확인 창, 공유 카드 틀, 버튼, 칩, 안내 문구
게임 안(게임 화면 가이드 MEME_RUSH_GAME_GUIDE)     플레이 중 그림, 캐릭터, 배경, 효과, 소리, 영상 컷의 그림체
```

## 2. 색은 정해진 토큰만 쓴다

규칙: 화면 바탕은 하늘색 그라데이션(sky-light에서 sky로), 큰 상자는 panel, 순위 카드는 row를 쓴다. 윤곽선과 보조 버튼은 navy, 카드 안 글자는 ink-blue다. 1등과 점수 강조는 gold, 내 순위 행은 hot, 2등은 silver, 3등은 bronze다. 주 버튼은 green, 닫기와 되돌릴 수 없는 일만 red다. 새 색은 이 목록에서 고르고, 목록에 없는 색은 쓰지 않는다.
적용: 서비스 화면 전체.
값:
```css
:root{--sky:#3EAEF5;--sky-light:#80E3FE;--panel:#4CC0F7;--row:#A3E8FA;--navy:#1C5692;--ink-blue:#0F3A73;--text-blue:#245887;
--gold:#FEDE25;--hot:#FFC531;--bronze:#F49E57;--silver:#D8DFEA;--green:#17803F;--red:#C93A52;--lime:#7AE83A;--warn-text:#7A5200;--warn-bg:#FFF1CF;--outline-white:#FFFFFF;--mascot:#EC8323;--mascot-line:#804526;--caption-line:#000000}
```

## 3. 글자는 읽히는 조합만 쓴다

규칙: 아래 표의 조합만 쓴다. 흰 글자와 밝은 파랑(#2A8CE0)은 대비 3.54로 부족해 작은 글자에 쓰지 않고, 버튼은 navy로 만든다. 큰 점수 숫자는 흰색에 navy 윤곽선 1.5px을 둘러 하늘색 위에서도 읽히게 한다. 색만으로 뜻을 나누지 않고 칩 글자("확인됨", "미확인", "열리지 않음")를 같이 쓴다.
적용: 서비스 화면의 모든 글자.
값:
```text
조합                              대비 비율   쓰는 곳
ink-blue / row                    8.26       카드 안 이름·설명
ink-blue / 흰색                   11.21      흰 상자 안 글자
ink-blue / hot                    7.09       내 순위 행 글자
흰색 / navy                       7.51       보조 버튼
흰색 / green                      5.0        주 버튼
흰색 / red                        4.99       닫기 버튼
#7A4A00 / gold                    5.59       1등 메달 숫자
```

## 4. 글꼴과 모양

규칙: 제목·순위·점수·버튼은 Jua, 설명·표·칩은 Noto Sans KR 500~700이다. 설명 글자는 12px(0.78rem)보다 작게 쓰지 않는다. 카드 모서리 14px, 큰 패널 22px, 버튼과 칩은 완전히 둥글게(99px). 카드는 흰 3px과 파랑 2px의 이중 테두리, 패널은 흰 4px과 navy 3px, 버튼은 아래 3px 그림자로 눌리는 느낌을 준다. 두 컷 자막(결과 화면)만 Anton 대문자를 쓴다(9절). 모든 글자는 이미지가 아닌 화면 글자로 둔다.
적용: 서비스 화면 전체.
값:
```text
제목 28px / 점수 22px / 게임 이름 18px / 버튼 17px / 설명 13px / 칩 12px
모서리 카드 14px, 패널 22px, 버튼·칩 99px
```

## 5. 주 동작은 크게, 보조는 글자 링크로 (UX 바이블 3)

규칙: 채운 버튼은 한 화면에 하나다(오늘의 게임으로 정하기, 한 판 시작하기, 다시 도전). 규칙 카드 보기와 공유 같은 보조 동작은 글자 링크로 낮춘다. 버튼 높이는 44px 이상이다.
적용: 동작이 둘 이상인 모든 서비스 화면.
값:
```text
채운 버튼: 한 화면에 1개, green, 높이 44px 이상
보조 동작: 글자 링크(굵게, 밑줄), navy 또는 ink-blue
```

## 6. 모바일은 엄지 자리에 (UX 바이블 20)

규칙: 폭 480px 이하에서는 주 버튼을 화면 아래쪽 가운데에 붙이고, 상단 모서리에는 자주 쓰는 버튼을 놓지 않는다. 순위 행은 행 전체를 눌러 펼친다. 확인 폭은 360px과 1280px이다.
적용: 폭 480px 이하의 서비스 화면.
값:
```css
@media (max-width:480px){.primary{position:sticky;bottom:10px;justify-content:center}}
```

## 7. 되돌리기 어려운 선택에는 확인 창 (UX 바이블 11)

규칙: "오늘의 게임으로 정하기"처럼 모두에게 보이는 선택은 확인 창을 띄운다. 제목은 질문 한 줄, 본문은 무엇이 바뀌는지와 되돌릴 수 있는지, 버튼은 [취소] [오늘의 게임으로 정하기] 순서다. 창이 열리면 포커스를 제목에 두고, 닫히면 연 버튼으로 돌려보낸다. Esc로 닫힌다. 브라우저 기본 confirm 창은 쓰지 않는다. 빨강은 되돌릴 수 없는 일에만 쓴다.
적용: 선택·삭제·권한 변경.
값:
```text
제목: 오늘의 게임을 {게임 이름}으로 정할까요?
본문: 정하면 현장 화면과 랭킹이 이 게임으로 바뀌어요. 선택 기록에 남고, 나중에 다른 게임으로 다시 정할 수 있어요.
버튼: [취소] [오늘의 게임으로 정하기]
```

## 8. 문구와 근거 표시

규칙: 문구는 짧은 해요체, 버튼은 동사와 결과다(한 판 시작하기, 내 순위 보기, 친구에게 점수 보내기). 점수는 숫자 하나로 보이고 천 단위 쉼표를 넣는다. 오차 같은 작은 값은 단위(초, 밀리초)를 붙인다. 인기 근거는 온라인 인기도와 커뮤니티 인기도로 보여 주고, 독립 출처가 하나뿐이면 칩으로 "단일 출처"를 표시한다. 근거가 하나도 없으면 카드 맨 위에 노란 경고(warn)를 붙이고 확인된 것처럼 꾸미지 않는다. 가상 수치에는 화면 위에 "샘플 자료"를 붙인다.
적용: 서비스 화면의 문구와 후보 카드.
값:
```text
좋은 예  한 판 시작하기 / 내 순위 보기 / 단일 출처 / 샘플 자료
피할 예  확인 / OK / 제출
```

## 9. 챔피언 스타일을 서비스 화면에 입힌다 (2026-10-24 사장님 확정 기준)

규칙: 게임 안의 챔피언 4장(플레이, 챔피언, 아쉬운 결과, 공유 카드)과 같은 세계로 보이게 서비스 화면을 맞춘다. 네 가지만 지키면 된다. 첫째, 결과 화면의 두 컷은 게임 가이드 6절의 자막 모양(흰 글씨, 검정 윤곽선 6~8px, 대문자 Anton, 가운데 정렬)으로 위아래 두 줄에 얹는다. 둘째, 버튼과 칩은 흰 테두리 2~3px로 스티커처럼 두르고 아래 그림자를 둔다. 셋째, 랭킹의 프로필은 주황 둥근 캐릭터를 흰 테두리 원 안에 넣고, 1~3등은 금·은·동 메달과 1등 왕관을 얹는다. 넷째, Global과 Friends 두 탭은 한 화면에 함께 보이고 내 줄은 hot으로 강조하며 위쪽 화살표를 붙인다. 이미지에 글자를 굽지 않는다.
적용: 결과 화면, 랭킹(Global·Friends), 공유 카드 틀, 리그 초대.
값:
```css
.caption{font-family:"Anton",Impact,sans-serif;text-transform:uppercase;color:#fff;text-align:center;
 -webkit-text-stroke:7px var(--caption-line);paint-order:stroke fill;line-height:1}
.btn,.chip{border:3px solid var(--outline-white);box-shadow:0 3px 0 var(--navy)}
.avatar{border:3px solid var(--outline-white);border-radius:50%;background:var(--mascot)}
```
