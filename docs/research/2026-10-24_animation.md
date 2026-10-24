# 리서치 원문: 밈·숏게임 이미지 애니메이션

조사일 2026-10-24(핏). 검색 연동 AI 리서치 원문이며 공식 문서로 대조하기 전이다. 가이드에 쓰인 값은 `MOTION_GUIDE.md`에서 확정값과 시작값으로 나뉘어 있다.

---

AI 기반 정지 이미지와 Phaser + FFmpeg 기술 스택 환경에서 5시간 해커톤 내 최상의 가성비와  meme(밈) 재미 요소를 극대화하기 위한 연출 조사 결과입니다.

---

### 1) 하이퍼캐주얼·밈 게임 연출 기법 ("게임 필", juice)
- **Squash & Stretch**: 타격/터치 시 오브젝트 찌그러뜨림 후 복원 (100~200ms, `Back.easeOut` / `Elastic.easeOut`).
- **Screen Shake**: 빗나감·실패 시 카메라 무작위 진동 (100~200ms, 대표 강연: Jan Willem Nijman - *The Art of Screenshake*).
- **Hitstop**: 임팩트 순간 게임 루프를 30~80ms 일시정지하여 타격감 증대.
- **Zoom Punch**: 탭 순간 화면을 1.1~1.2배 정점 확대 후 원복 (100~150ms, `Sine.easeOut`).
- **Flash**: Perfect 반응 시 화면 50~100ms 흰색/노란색 반짝임.
- **파티클 & 글자 팝**: 탭 시 10~15개 이모지 튀김과 "PERFECT!" 텍스트 팝업 (150~300ms, `Back.easeOut`).
- **핵심 조언**: Martin Jonasson & Petri Purho (*Juice it or lose it*)는 작은 입력 1개에 과장된 시각·음향 피드백을 중첩 연출할 것을 권장함.
- **출처**: 
  - https://www.gdcvault.com/play/1016485/Juice-It-or-Lose
  - https://kenney.nl/blog/the-best-game-feel-talks-and-videos

---

### 2) 애니메이션 구현 방식 비교 (가성비 최우선)
- **프레임 스프라이트 시트**: 용량 큼, AI 정지 컷으로 연속 프레임 제작 수공수 과다.
- **정지 이미지 트윈 (이동·회전·크기)**: 용량 최적, 구현 난이도 최저, 성능 최고 (**5시간 해커톤 최적 가성비 방식**).
- **컷아웃 파츠 리깅 (Spine)**: 자연스러우나 뼈대 파츠 분리/리깅 도구 학습시간 부족으로 불가능 [확인 못 함: 5시간 내 완성 가능 여부].
- **Lottie**: Vector 위주라 래스터 AI 컷 호환성 낮음.
- **CSS/Canvas 트윈**: 렌더 루프 분리로 Phaser 내장 트윈 시스템 활용이 절대적 우위.
- **투명 WebM 루프**: 파일 용량 크고 보급형 안드로이드 브라우저 모바일 자동재생 병목.
- **출처**: https://generalistprogrammer.com/phaser/phaser-performance-optimization-guide-60-fps-on-every-device/

---

### 3) AI 정지 이미지를 싸게 움직이는 방법
- **표정 컷 교체 (Instant Swap)**: 상황에 맞는 표정 9가지 이미지로 즉시 교체(`setTexture`).
- **2~4프레임 포즈 스왑 + 트윈**: 동작 5컷을 150~250ms 간격 스왑하며 트윈 위치 이동 조합.
- **제한 애니메이션 (8~12fps)**: 60fps 대신 8~12fps 간격 이미지 스왑으로 짤방/스톱모션 밈 감성 전달.
- **루프 트윈 (숨쉬기)**: 파츠 분리 없이 캐릭터 Y축 상하(±5px, 600ms, `Sine.easeInOut`) 및 Scale(1.02배) 루프.
- **파츠 분리 필요성**: 파츠 분리 없이 '전체 컷 교체 + 카메라 연출'만으로 밈 연출 100% 구현 가능.
- **출처**: 
  - https://generalistprogrammer.com/phaser/phaser-performance-optimization-guide-60-fps-on-every-device/
  - https://stackoverflow.com/questions/56286524/phaser-3-camera-pan-zoom-and-easing

---

### 4) Phaser 구현 및 보급형 성능 최적화
- **Tweens & Timeline**: `this.tweens.chain()`으로 찌그러짐→복원 연쇄 적용 (`Back.easeOut`, `Sine.easeInOut`).
- **Camera API**: `this.cameras.main.shake(150, 0.01)`, `flash(100)`, `zoomTo(1.15, 100)` 파이프라인 활용.
- **파티클 & 오브젝트 풀링**: `add.particles` 시 `maxParticles: 15` 제한 및 풀링으로 쓰레기 수집(GC) 병목 방지.
- **60fps 보급형 폰 팁**: Texture Atlas(단일 드로우콜) 묶음 사용 및 동시 파티클 20개 이하 고정.
- **출처**: 
  - https://phaser.io/phaser3/api-documentation/class/Camera
  - https://generalistprogrammer.com/phaser/phaser-performance-optimization-guide-60-fps-on-every-device/
  - https://medium.com/p/ed9dbb1c1e54

---

### 5) 결과 영상 (서버 FFmpeg) 연출
- **zoompan 확대**: `zoompan=z='min(zoom+0.002,1.2)':d=30:x='iw/2-(iw/zoom/2)':y='ih/2-(ih/zoom/2)':s=720x1280:fps=30`.
- **흔들림**: `crop=w=in_w-20:h=in_h-20:x='(in_w-out_w)/2+sin(n*0.5)*10':y='(in_h-out_h)/2+cos(n*0.5)*10'`.
- **자막 팝인**: `drawtext=text='PERFECT':fontsize='if(lt(t,0.2),40+t*100,60)':x=(w-text_w)/2:y=(h-text_h)/2`.
- **장면 전환**: `xfade=transition=fadeblack:duration=0.3:offset=2.7`.
- **서버리스 기술 비교**: FFmpeg(바이너리 실행 빠른 서버리스 적합, 메모리 적음) vs Remotion(React/CSS로 렌더링 쉬우나 Headless Browser 구동으로 서버리스 연산/시간 비용 큼).
- **출처**: 
  - https://ffmpeg.org/ffmpeg-filters.html
  - https://snapcn.dev/blog/remotion-vs-ffmpeg/

---

### 6) 접근성과 안전
- **번쩍임 제한 (WCAG 2.3.1)**: 화면 전체 깜빡임(Flash)은 1초당 3회 이하로 제한 (광과민성 발작 방지).
- **prefers-reduced-motion**: `window.matchMedia('(prefers-reduced-motion: reduce)')` 감지 시 카메라 shake/zoom 강도 0 처리.
- **밈 게임 흔들림 권장 강도**: Phaser 기준 `shake(150ms, 0.005 ~ 0.01)`로 지속시간 200ms 이하, 10px 미만 범위 조율.
- **출처**: 
  - https://www.w3.org/WAI/WCAG21/Understanding/three-flashes-or-below-threshold.html
  - https://boia.org/blog/understanding-wcag-2.1-guidelines-2.3.1-three-flashes-or-below-threshold

---

### 7) 참고 사례 (Short-form 바이럴 유발)
- **Fruit Ninja & Vampire Survivors**: 콤보 시 순간 히트스톱, 텍스트 팝업, 찌그러짐이 타격감과 즉각적 몰입 유발.
- **Flappy Bird & Wordle**: 실패/성공 순간 직관적 짤 표정과 점수 카드 연출로 SNS 캡처 공유 자극.
- **밈 반응 영상 (Reactions)**: 탭 시 의외의 파탄적 표정 교체(AI 컷 스왑)와 순간 줌 펀치(Zoom Punch) 연출이 숏폼 웃음 포인트로 결합.
- **출처**: https://reddit.com/r/gamedesign/comments/uf09p/juice_it_or_lose_it_a_talk_by_martin_jonasson/

---

### 우리가 쓸 연출 목록

1. **대기 (Idle) 장면**
   - 연출 효과: 평온한 표정 AI 컷 + 캐릭터 Y축 미세 숨쉬기 루프 트윈
   - 시간(ms): 600ms (Infinite Yoyo)
   - 이징: `Sine.easeInOut`
   - 구현 방식: Phaser 트윈

2. **탭 (Tap) 동작**
   - 연출 효과: 동작 포즈 AI 컷 교체 + 찌그러짐(Scale X:1.15, Y:0.85 -> 복원)
   - 시간(ms): 120ms
   - 이징: `Back.easeOut`
   - 구현 방식: Phaser 트윈

3. **Perfect 반응**
   - 연출 효과: 과장된 환호 AI 표정 컷 + Camera Flash(100ms) + Zoom Punch(1.15배) + 파티클 15개 + "PERFECT!" 자막 팝
   - 시간(ms): 150ms
   - 이징: `Bounce.easeOut` (자막), `Sine.easeOut` (카메라)
   - 구현 방식: Phaser 카메라 & 파티클 (클라이언트) / FFmpeg `drawtext` & `zoompan` (서버 MP4)

4. **Too Early (조기 실패)**
   - 연출 효과: 억울/당황 AI 표정 컷 + Camera Shake(0.008 intensity) + 캐릭터 좌우 갸웃 트윈
   - 시간(ms): 180ms
   - 이징: `Linear` (Shake), `Sine.easeOut` (회전)
   - 구현 방식: Phaser 카메라 (클라이언트) / FFmpeg `crop` 쉐이크 필터 (서버 MP4)

5. **Too Late (지연 실패)**
   - 연출 효과: 멘붕/해탈 AI 표정 컷 + Hitstop(50ms 일시정지) + Camera Shake(0.012 intensity) + "FAIL" 자막 낙하
   - 시간(ms): 250ms
   - 이징: `Elastic.easeOut`
   - 구현 방식: Phaser 타이머 & 카메라 (클라이언트) / FFmpeg `drawtext` & `crop` (서버 MP4)
