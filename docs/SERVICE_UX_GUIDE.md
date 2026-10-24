---
name: MEME_RUSH_SERVICE_UX_GUIDE
colors:
  bg: '#140C09'
  bg2: '#1F130E'
  ink: '#FFF4E8'
  muted: '#BDB3AA'
  fire: '#FF6A2B'
  fire-shadow: '#9A3A12'
  gold: '#FFB547'
  kraft: '#E8C49A'
  sky: '#58B6F2'
  line: '#4B413B'
  stage: '#F4F1E8'
spacing:
  '2': 8px
  '3': 12px
  '4': 16px
rounded:
  md: 22px
  lg: 36px
typography:
  display:
    fontSize: 92px
    fontWeight: '400'
    lineHeight: '1.02'
  h2:
    fontSize: 68px
    fontWeight: '400'
    lineHeight: '1.02'
  body:
    fontSize: 18px
    fontWeight: '500'
    lineHeight: '1.55'
  caption:
    fontSize: 13px
    fontWeight: '700'
    lineHeight: '1.4'
---

## 1. 범위: 사용자와 투자자가 먼저 만나는 바깥 화면을 정한다

규칙: 이 가이드는 Meme Rush의 서비스 UX를 정한다. 홍보 사이트, 사전 예약 페이지, 발표자료, 공유 미리보기처럼 게임을 아직 모르는 사람이 먼저 보는 화면이 대상이다. 운영자 화면과 게임 안의 서비스 화면(랭킹, 후보 관리, 확인 창)은 어드민 UX 가이드(MEME_RUSH_ADMIN_UX_GUIDE)를 따른다. 게임 안 그림은 MEME_RUSH_GAME_GUIDE, 문구의 말투와 길이는 MEME_RUSH_WRITING_GUIDE가 정한다. 부딪히면 바깥 화면의 모양과 틀은 이 가이드가 이긴다.
적용: 홍보 사이트, 사전 예약 페이지, 발표자료(2장), 공유 미리보기(OG).
값:
```text
서비스 UX(이 가이드)   홍보 사이트, 사전 예약, 발표자료, OG 미리보기
어드민 UX              MEME_RUSH_ADMIN_UX_GUIDE (랭킹, 후보 관리, 확인 창, 게임 안 서비스 UI)
게임 화면              MEME_RUSH_GAME_GUIDE
문구                   MEME_RUSH_WRITING_GUIDE
```

## 2. 색은 정해진 토큰만 쓴다: 어두운 바탕에 불꽃 주황과 금색

규칙: 바탕은 어두운 갈색 검정(bg), 상자는 한 단계 밝은 bg2, 글자는 크림색(ink)이다. 주 버튼과 강조 칩은 fire, 제목의 한 줄 강조와 단계 이름은 gold, 부제는 kraft다. 보조 글자는 muted를 쓴다. 발표자료 밖 설명 상자(제출 전 확인 등)만 밝은 stage 바탕에 둔다. 목록에 없는 색은 쓰지 않는다. 히어로와 마지막 CTA 뒤에는 fire를 옅게 번지게 한 둥근 빛 하나만 둔다.
적용: 홍보 사이트, 사전 예약, 발표자료.
값:
```css
:root{--bg:#140C09;--bg2:#1F130E;--ink:#FFF4E8;--muted:#BDB3AA;--fire:#FF6A2B;--fire-shadow:#9A3A12;--gold:#FFB547;--kraft:#E8C49A;--sky:#58B6F2;--line:#4B413B;--stage:#F4F1E8}
.glow{background:radial-gradient(900px 520px at 78% 30%,rgba(255,106,43,.28),transparent 70%),var(--bg)}
```

## 3. 글자는 읽히는 조합만 쓴다

규칙: 아래 조합만 쓴다. 흰 글자를 fire 위에 얹지 않는다(대비 2.86으로 부족). 주 버튼은 fire 바탕에 bg 글자다. 색만으로 뜻을 나누지 않고 단계 이름과 칩에 글자를 같이 쓴다.
적용: 모든 글자.
값:
```text
조합              대비 비율   쓰는 곳
ink / bg          17.82      제목, 본문
ink / bg2         16.72      상자 안 본문
gold / bg         11.0       강조 제목, 단계 이름
kraft / bg        11.78      부제
muted / bg        9.38       보조 설명, 안내 한 줄
bg / fire         6.76       주 버튼 글자
fire / bg         6.76       작은 라벨(HOW IT WORKS)
bg / gold         11.0       금색 칩
금지: 흰색 / fire (2.86)
```

## 4. 글꼴과 크기

규칙: 제목과 단계 이름은 Anton 대문자, 본문과 버튼은 Figtree, 한국어 화면은 Noto Sans KR 800과 500이다(Anton은 한글이 없다). 제목 줄간격은 1.02에서 1.06 사이, 본문은 1.55다. 한 줄 소개는 24px 안팎의 kraft 굵은 글씨로 최대 30자 폭에 맞춘다. 글자 크기는 화면 폭에 따라 clamp로 줄어들게 한다.
적용: 홍보 사이트, 사전 예약, 발표자료.
값:
```css
h1{font-family:Anton,Impact,sans-serif;font-size:clamp(48px,7.2vw,92px);text-transform:uppercase;line-height:1.02}
h2{font-size:clamp(38px,5.4vw,68px)}
.sub{font-size:clamp(19px,2.4vw,26px);font-weight:700;color:var(--kraft);max-width:30ch}
```
발표자료(1920 x 1080)는 제목 76~104px, 상자 본문 23~27px, 라벨 20px이다.

## 5. 버튼: 주 버튼은 한 화면에 하나, fire 바탕에 어두운 글자

규칙: 채운 버튼은 한 화면에 하나(Play now)이고 fire 바탕에 bg 글자, 아래에 fire-shadow 6px 그림자를 둔다. 보조는 ink 2px 테두리의 빈 버튼(See how it works)이다. 높이는 56px 이상, 모서리는 완전히 둥글게(99px)다. 폭 820px 이하에서는 두 버튼이 한 줄씩 꽉 차게 쌓는다. 누르면 4px 내려간다. 키보드 포커스는 gold 3px 윤곽선이다. 버튼 글자는 WRITING_GUIDE 4절의 고정 문구를 쓴다.
적용: 홍보 사이트의 모든 CTA.
값:
```css
.btn.primary{background:var(--fire);color:var(--bg);box-shadow:0 6px 0 var(--fire-shadow);min-height:60px;border-radius:99px}
.btn.ghost{border:2px solid var(--ink);color:var(--ink)}
.btn:active{transform:translateY(4px)}
.btn:focus-visible{outline:3px solid var(--gold);outline-offset:3px}
@media(max-width:820px){.btn{width:100%}}
```

## 6. 폰 스티커: 챔피언 이미지는 흰 테두리 폰에 담는다

규칙: 게임 이미지는 9:16 비율을 지킨 채 흰 테두리 8~9px, 모서리 30~36px의 폰 모양에 담고, 아래에 검은 그림자(투명도 45%)를 둔다. 폰은 -7도에서 +5도 사이로 기울이고, 두 폰을 겹칠 때는 뒤 폰의 글자(TAP NOW)가 가려지지 않게 겹침을 폰 폭의 15% 안으로 한다. 그림을 잘라 쓰지 않고(object-fit: cover는 같은 비율에서만), 이미지에 구워진 글자는 가리지 않는다. 가상 이름과 점수가 보이는 시안에는 "CONCEPT ART · NAMES AND SCORES ARE PLACEHOLDERS" 한 줄을 붙인다.
적용: 히어로, 단계 설명, 발표자료.
값:
```css
.ph{border:9px solid #fff;border-radius:36px;box-shadow:0 18px 0 rgba(0,0,0,.45);overflow:hidden;aspect-ratio:9/16}
.ph.a{transform:rotate(-7deg)} .ph.b{transform:rotate(5deg)}
```

## 7. 히어로: 한 줄 약속, 주 버튼, 움직이는 그림

규칙: 히어로는 위에서 아래로 라벨 칩(DAILY MEME GAME, fire), 제목 세 줄(둘째 줄은 gold 강조), 한 줄 소개(kraft), 버튼 두 개, 안내 한 줄(RUNS IN YOUR BROWSER · NO INSTALL · NO SIGNUP)이고, 오른쪽에 예고편 영상 폰과 챔피언 폰을 둔다. 영상은 소리 없이 자동 재생·반복하고 poster 이미지를 지정한다. 제목은 약속(Today's meme. 30 seconds. Beat your friends.)이고 설명이 아니다. 주 버튼은 사전 예약 페이지로 간다.
적용: 홍보 사이트 첫 화면.
값:
```html
<video autoplay muted loop playsinline preload="auto" poster="img/poster.jpg"><source src="trailer.mp4" type="video/mp4"></video>
```
예고편 영상 규격: 세로 720x1280, 15초 안팎, 2MB 이하, 소리 없음, 끝 장면에 MEME RUSH와 COMING SOON.

## 8. 사전 예약: 버튼 한 번, 이메일 한 칸, 확인 문구는 고정

규칙: Play now는 게임이 열리기 전까지 사전 예약 페이지로 간다. 입력은 이메일 한 칸이고 완료 화면의 문구는 고정이다. 신청이 들어오면 사람이 확인해야 하므로 확인 담당(마야)을 정해 두고 응답을 매일 본다. 게임이 열리면 Play now의 연결 주소만 바꾼다.
적용: 사전 예약 페이지.
값:
```text
제목    Be the first to play it.
안내    Leave your email. You'll be among the first people in the world to meet Meme Rush.
완료    You're in. Meme Rush request received.
        You'll be among the first people in the world to meet Meme Rush. We'll email you the moment it opens.
```

## 9. 발표자료: 1920 x 1080 두 장, 로고 띠 자리는 비운다

규칙: 발표자료는 16:9 두 장이고 1920 x 1080 무대를 화면 폭에 맞춰 축소한다. 위쪽에 팀 이름(왼쪽)과 주제 라벨(오른쪽, fire), 아래쪽에 행사 로고 띠 자리(폭 90%, 높이 112px)를 비운다. 1장은 약속, 목표 시장, 문제, 폰 두 개이고, 2장은 폰 세 개, 근거 한 줄(출처 포함), 상자 세 개(순환, 목표, 오늘 만든 것과 앞으로 30일)다. 제출 영문판과 이해용 한글판을 같은 틀로 만든다.
적용: 해커톤 제출 PDF.
값:
```text
무대 1920x1080 / 좌우 여백 96px / 로고 띠 bottom 34px, 높이 112px
상자 padding 16~26px, 본문 23~27px / 폰 사이 간격 30px
```

## 10. 넘침 방지: 글자와 버튼이 상자 밖으로 나가지 않게 만든다

규칙: 상자와 열에는 min-width: 0과 overflow-wrap을 준다. 칩 줄은 flex-wrap으로 줄바꿈을 허용한다. 큰 제목은 글꼴이 늦게 불러와져도 안 넘치도록 상자 폭의 85%까지만 쓴다. 폰 안의 구운 글자는 폰 크기에 맞춰 같이 줄어들게 하고 다른 폰이 덮지 않게 한다. 올리기 전에 1280px과 500px 폭을 화면으로 보고, 발표자료는 두 장 모두 로고 띠 자리 위에서 끝나는지 확인한다.
적용: 모든 서비스 UX 화면.
값:
```css
.box,.col{min-width:0;overflow-wrap:anywhere}
.chips{display:flex;flex-wrap:wrap;gap:8px}
```

## 11. 올리기 전 점검표

규칙: 아래 여덟 개를 확인한다. 하나라도 아니면 고친다.
적용: 서비스 UX가 들어간 모든 PR과 발표자료.
값:
```text
1. 토큰에 없는 색을 쓰지 않았는가
2. 흰 글자를 fire 위에 얹지 않았는가
3. 채운 버튼이 한 화면에 하나인가
4. 폰 그림이 9:16이고 서로 가리지 않는가
5. 1280px과 500px 화면에서 글자와 버튼이 상자 안에 있는가
6. 가상 이름과 점수에 CONCEPT ART 표시가 있는가
7. 숫자에 출처 또는 target 표시가 있는가
8. 문구가 MEME_RUSH_WRITING_GUIDE를 따르는가
```
