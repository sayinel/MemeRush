---
name: MEME_RUSH_WRITING_GUIDE
---

## 1. 범위: 사용자에게 보이는 모든 영어 문구와 투자자용 글을 정한다

규칙: 이 가이드는 Meme Rush의 영어 문구를 정한다. 게임 자막, 버튼과 안내, 결과 문구, 공유 문구, 영상 CTA, 앱 소개 한 줄, 발표자료와 소개글이 대상이다. 문구의 말투와 길이는 이 가이드가 정본이다. 그림과 자막 모양(글꼴, 색, 윤곽선)은 MEME_RUSH_GAME_GUIDE, 서비스 화면의 틀은 MEME_RUSH_SCREEN_GUIDE, 값이 자주 바뀌는 연출은 MEME_RUSH_MOTION_GUIDE를 따른다. 부딪히면 문구는 이 가이드가, 모양은 해당 가이드가 이긴다.
적용: 게임 틀이 보여 주는 모든 글, 결과 영상, 공유 카드, OG 미리보기, 서비스 화면, 발표자료, README.
값:
```text
언어      사용자에게 보이는 문구는 영어만 [확정: MVP_SCOPE 언어 결정]
한국어    운영자만 보는 내부 화면의 안내문과 사람끼리 쓰는 문서
부딪힐 때  문구 = 이 가이드 / 모양 = GAME_GUIDE / 틀 = SCREEN_GUIDE
```

## 2. 목소리: 친구가 옆에서 놀리는 드라이한 한 줄

규칙: 말투는 짧고 건조하다. 한 문장에 사건 하나만 넣는다. 설명하지 않고 보여 준다. 놀리는 대상은 플레이어의 캐릭터 자신뿐이고, 플레이어를 몰아붙이지 않는다. 진 사람에게도 한 번 더 하게 만드는 말을 쓴다. 느낌표는 한 화면에 하나까지 쓴다.
적용: 자막, 결과 문구, 공유 문구, 안내 문구.
값:
```text
쓴다    짧은 현재형 / 구체적인 사물(email, boss, 5:00) / 숫자 하나 / "again"이 들어간 재도전 말
피한다  설명하는 긴 문장 / 느낌표 연타 / 이모지 나열 / 플레이어를 탓하는 말("You failed")
예시    "0.087s off. So close."  "The boss saw you."  "One more try?"
```

## 3. 자막: 위 줄은 상황, 아래 줄은 결과, 줄마다 30자 이하

규칙: 자막은 두 줄이다. 위 줄은 상황이나 반전, 아래 줄은 결과나 한 방이다. 한 줄은 공백과 문장부호를 포함해 30자 이하다. 대문자로 쓰고 모양은 GAME_GUIDE 6절을 따른다. 한 줄에 아이디어 하나만 넣는다. 글자 속 이모지와 해시태그는 쓰지 않는다. 숫자는 단위를 붙인다(0.087s).
적용: 결과 영상의 두 컷 자막(`top`, `bottom`), 게임 장면의 자막. 밈 카드 검증도 같은 30자를 쓴다.
값:
```text
길이      줄당 30자 이하 [확정: MVP_SCOPE 가이드 적용 규칙, 옛 60자 기준은 폐기]
구조      top = 상황·반전 / bottom = 결과·한 방
예시(시작값)
  hope   FRIDAY 5PM. ALMOST FREE.           (24자)
  win    YOU CLOCKED OUT.  /  0.087S OFF. LEGEND.
  early  TOO EARLY. THE BOSS SAW YOU.       (28자)
  late   TOO LATE. ONE MORE EMAIL.          (25자)
```

## 4. 버튼과 안내: 동사로 시작하고 결과를 말한다

규칙: 버튼은 동사로 시작하고 세 단어 안에서 결과를 말한다. 한 화면의 주 버튼은 하나다. 아래 고정 문구는 그대로 쓰고, 새 문구는 첫 글자만 대문자로 쓴다. 오류와 빈 화면은 무슨 일이 있었는지와 다음에 할 일을 한 문장씩 쓴다. 사과 문구와 기술 용어("Error 500")는 쓰지 않는다.
적용: 서비스 화면의 버튼, 확인 창, 빈 상태, 오류 안내.
값:
```text
고정(그대로)   Play now / See my rank / Challenge a Friend / Join {owner}'s league & play [확정: MVP_SCOPE]
새 버튼(시작값)  Try again / Copy link / Save video / Share result
빈 상태        "No one here yet. Be the first."
오류           "That didn't save. Try again." (원인 코드는 화면에 쓰지 않는다)
```

## 5. 결과 문구: 세 가지 결과와 한 줄 기록

규칙: 결과는 `win`(Perfect), `lose`·`early`(Too Early), `lose`·`late`(Too Late) 세 가지다. 합산 오차 300ms 이하가 win이다. 기록은 "0.087s off"처럼 소문자 s와 off로 쓰고, 1위와의 차이는 "0.042s behind #1"처럼 쓴다. 졌을 때도 다음 행동을 같이 둔다.
적용: 결과 화면, 결과 영상, 공유 카드.
값:
```text
Perfect     "Perfect. 0.087s off."            [확정: 종류와 기록 표기 = MVP_SCOPE]
Too Early   "Too early. 0.214s off."  + "Try again"
Too Late    "Too late. 0.341s off."   + "Try again"
순위 차이    "0.042s behind #1" / 1위일 때 "0.031s ahead of #2"
```

## 6. 공유 문구: 스포일러 없이 두세 줄

규칙: 공유 문구는 Wordle처럼 결과를 한눈에 보여 주고 정답(목표 시간)은 알려 주지 않는다. 두세 줄, 링크 하나, 해시태그는 하나까지다. 닉네임과 리그 정보는 넣지 않는다(미리보기에 공유한 사람의 기록만 표시한다는 결정과 같다).
적용: Wordle식 텍스트 공유, OG 제목과 설명, 영상 업로드 캡션.
값:
```text
형식(시작값)
  Meme Rush #001 | 0.087s off
  Can you beat it?
  {public challenge URL}
OG 제목   "Meme Rush #001: Clock out at 5:00"
OG 설명   "30 seconds. 3 rounds. Beat my 0.087s."
```

## 7. 투자자용 글: 한 줄 소개부터 쓰고, 근거 없는 말은 쓰지 않는다

규칙: 한 줄 소개는 "[제품] for [누구] so they can [얻는 것]" 틀로 쓰고 10단어 안에서 끝낸다. 첫 문장에서 인사말과 배경 설명을 빼고 제품이 무엇인지 말한다. 숫자는 출처가 있는 것만 쓰고, 목표와 가설에는 "target"이나 "hypothesis"를 붙인다. 아직 없는 사용자 지표를 있는 것처럼 쓰지 않는다. 실사용 지표가 없으면 "Early signals" 칸에 오늘 만든 것, 시장 근거, 30일 실험 목표를 둔다. 아래 단어는 쓰지 않는다.
적용: 발표자료, 제출 양식의 한 줄 소개, README 첫 줄, 마케팅 글.
값:
```text
틀(시작값)   Today's meme becomes a 30-second game for friends.   (8단어)
금지 단어    next-generation / revolutionizing / disrupting / paradigm / synergy / "Uber for X"
             AI-powered platform처럼 무엇인지 말하지 않는 표현
근거 표기    사례 수치에는 출처 이름을 붙인다 / 확인 못 한 것은 "unverified"
```

## 8. 지킬 것: 밈 원본, 실존 인물, 상표는 쓰지 않는다

규칙: 밈의 원본 문구와 이미지, 실존 인물, 상표, 음원은 쓰지 않고 형식과 순간만 가져온다. 특정인 조롱, 혐오, 약물과 성적 암시는 쓰지 않는다. 실패 장면은 플레이어 캐릭터 자신을 놀리는 데서 그친다. 보스는 특정 실존 인물을 닮게 쓰지 않는다. AI가 쓴 문구는 사람이 보고 승인한 뒤에만 커밋한다. 문구를 만든 도구와 경로는 문서·커밋·PR에 적지 않는다.
적용: 모든 문구.
값:
```text
승인   AI 초안 -> 사람 확인 -> 커밋 [확정: GAME_GUIDE 11절과 같은 규칙]
금지   원본 밈 문구 인용 / 실존 인물·상표 이름 / 특정인 조롱
```

## 9. 영어 점검: 한국어 직역을 걸러낸다

규칙: 짧은 단어와 현재형, 명령형을 쓴다. 한국어에서 그대로 옮긴 표현은 쓰지 않는다. 날짜는 "Oct 24", 시간은 "5:00", 기록은 "0.087s"로 쓴다. 마침표는 자막과 버튼에서는 쓰지 않거나 문장 사이에만 쓴다.
적용: 영어로 새로 쓰는 모든 문구.
값:
```text
걸러낼 표현(시작값)
  "Fighting!" -> "Let's go"   /   "Please play" -> "Play now"
  "Challenge your friend now" -> "Challenge a Friend"
  "Your record is" -> 숫자만 크게, "0.087s off"
```

## 10. 점검표: 올리기 전에 이 여덟 개를 확인한다

규칙: 문구를 커밋하거나 발표자료에 넣기 전에 아래를 본다. 하나라도 아니면 고친다.
적용: 문구가 들어간 모든 PR과 발표자료.
값:
```text
1. 자막 줄마다 30자 이하인가
2. 한 줄에 아이디어가 하나인가
3. 버튼이 동사로 시작하고 세 단어 안인가
4. 기록에 단위(0.087s)가 있는가
5. 금지 단어(next-generation, revolutionizing, disrupting)가 없는가
6. 숫자에 출처가 있거나 target/hypothesis 표시가 있는가
7. 밈 원본, 실존 인물, 상표가 없는가
8. 사람이 읽고 승인했는가
```
