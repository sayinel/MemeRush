# 리서치 원문: 이미지·영상 에셋 형식과 규격

조사일 2026-10-24(핏). 검색 연동 AI 리서치 원문이며 공식 문서로 대조하기 전이다. 가이드에 쓰인 값은 `ASSET_GUIDE.md`에서 확정값과 시작값으로 나뉘어 있다.

---

Next.js(App Router) + Vercel + Supabase + FFmpeg 기반의 모바일 세로형 웹 게임 및 영상 공유 서비스를 구축할 때 필요한 이미지·영상 에셋의 형식 및 규격 정리입니다. 각 항목마다 확인된 공식/신뢰할 수 있는 출처 URL을 포함하였으며, 확정되지 않은 항목은 '확인 못 함'으로 기재했습니다.

---

### 1) 링크 미리보기(OG) / 트위터 카드 (Twitter Cards)

* **권장 크기 및 비율**:
  * **표준 OG 이미지**: **1200 x 630 px** (비율 1.91:1). 가장 넓은 범위에서 호환되는 표준 크기입니다.
  * **텍스트/로고 안전 영역**: 각 플랫폼별 모바일 크롭을 고려해 중앙 **1080 x 600 px** 이내에 핵심 텍스트와 로고를 배치하는 것이 안전합니다.
* **허용 형식**: **PNG, JPEG, WebP** (일부 플랫폼 한정 지원).
* **최대 파일 용량 및 플랫폼별 차이점**:
  * **Facebook (Meta)**: 권장 1200x630 px, 최대 **8 MB**. 600x315 px 미만일 경우 작은 정사각형 썸네일로 축소되며, 첫 공유 시 지연 없는 렌더링을 위해 `og:image:width`, `og:image:height` 메타 태그 작성이 권장됩니다.
    * 출처: https://developers.facebook.com/docs/sharing/webmasters/images/
  * **X (Twitter)**: `<meta name="twitter:card" content="summary_large_image">` 설정 필요. 권장 규격은 1200x675 px (16:9) 또는 1200x600 px (2:1)이며, 1200x630 px 사용 시 상하단이 미세하게 잘립니다. 최대 용량 **5 MB**.
    * 출처: https://docs.x.com/
  * **Slack**: 권장 1200x630 px, 최대 용량 **1 MB**. Slackbot은 HTML 응답의 **상위 32 KB**만 수집하므로 `<head>` 태그 최상단에 메타태그를 배치해야 합니다.
    * 출처: https://api.slack.com/robots
  * **Discord**: 권장 1200x630 px. 채팅창 인라인 영역(~400x300 px) 크기에 맞추어 자동 축소 렌더링되며, 자체 CDN으로 이미지를 캐싱합니다. 최대 용량 **8 MB**.
    * 출처: https://discord.com/developers/docs
  * **Telegram**: 권장 1200x630 px (1.91:1), 최대 용량 **5 MB**.
    * 출처: https://core.telegram.org/
  * **KakaoTalk (카카오톡)**: 권장 **1200 x 630 px** (1.91:1). 파일 용량 **1 MB 이하** 권장 (스크랩 서버 허용은 최대 5 MB). 카카오 스크랩 서버가 캐시를 보관하므로 변경 시 카카오 디벨로퍼스 OG 캐시 초기화 도구 활용이 필요합니다.
    * 출처: https://developers.kakao.com/
* **애니메이션 GIF의 미리보기 동작 여부**:
  * **불가 (움직이지 않음)**: Facebook, X, Discord, Slack, KakaoTalk, Telegram 등 모든 주요 플랫폼의 OG 링크 미리보기 카드에서는 GIF의 **첫 번째 프레임(정지 이미지)**만 렌더링됩니다. (GIF가 움직이는 경우는 링크 미리보기가 아니라 채팅창에 GIF 파일 자체를 직접 첨부했을 때만 해당합니다.)

---

### 2) 결과 공유용 영상/이미지 포맷 (MP4 vs GIF)

* **GIF 대신 MP4가 나은 이유**:
  * **용량 및 화질**: MP4(H.264)는 동일한 visual 품질 대비 GIF보다 파일 용량이 **10배~20배 작으며**, GIF의 256색 제한과 달리 24비트 컬러를 지원합니다.
  * **iOS Safari 자동재생 조건**: iOS Safari 및 모바일 브라우저에서 사용자의 직접 클릭 없이 비디오가 인라인으로 자동재생되려면 `<video>` 태그에 **`autoplay`**, **`muted`** (또는 음성 트랙 없음), **`playsinline`** 속성이 **모두 포함**되어야 합니다.
    * 출처: https://webkit.org/blog/6784/new-video-policies-for-ios/
* **주요 플랫폼 공유 시 처리 차이 및 파일 용량 제한**:
  * **모바일 웹 공유 (`navigator.share({ files: [videoFile] })`)**:
    * **Instagram / TikTok**: 웹 브라우저에서 `navigator.share` API로 MP4 비디오 파일을 전달해야 모바일 OS의 네이티브 공유 창을 거쳐 인스타그램(릴스/스토리) 및 틱톡 앱으로 '비디오 파일' 데이터가 올바르게 연동됩니다. GIF/WebP는 단순 정지 이미지로 처리되거나 비디오 업로드 타겟에서 제외됩니다.
    * 출처: https://developer.mozilla.org/en-US/docs/Web/API/Navigator/share
    * **X (Twitter)**: MP4 직접 첨부 업로드 지원 (웹/앱 파일 업로드 한도 512 MB).
    * **Telegram / Discord**: MP4 업로드 시 인라인 플레이어로 바로 재생 가능하며, GIF에 비해 전송 속도가 매우 빠


(이어서 3~6번 항목)

### 3) 게임 화면 자체 에셋 규격
- **권장 형식**: 투명 배경 요소(버튼, 캐릭터, 스티커)는 PNG 또는 WebP, 배경 이미지는 WebP/JPEG, 아이콘·벡터 그래픽은 SVG를 사용합니다. 현대 브라우저는 WebP 및 AVIF를 기본 지원합니다.
  - 출처: https://developer.mozilla.org/en-US/docs/Web/Media/Formats/Image_types
- **권장 용량 및 해상도**: 모바일 웹 초기 로딩 최적화를 위해 개별 에셋당 100~300KB 이내(전체 페이지 1~2MB 이내)를 권장합니다. 레티나(@2x/@3x) 디스플레이 선명도를 위해 원본은 기준 세로 화면(360~430px) 대비 2배수(@2x, 가로 720~1080px 수준)로 제작 후 CSS로 축소 표현합니다.
  - 출처: https://developer.apple.com/design/human-interface-guidelines/image-locations
- **스프라이트 시트 vs 개별 파일**: Canvas/WebGL 기반 게임이거나 렌더링 프레임 애니메이션이 많다면 HTTP 요청 감소를 위해 스프라이트 시트(Texture Packer 활용)가 유리합니다. Next.js DOM 기반의 단순 UI인 경우 이미지 최적화(`<Image>`)와 캐싱 배포를 위해 개별 WebP/PNG 파일 관리 방식을 권장합니다.
  - 출처: https://nextjs.org/docs/app/building-your-application/optimizing/images

---

### 4) 파비콘·홈 화면 아이콘·소셜 공유 아이콘 크기 목록
- **파비콘 (Favicon)**: `favicon.ico` (16x16, 32x32, 48x48 픽셀 멀티 레이어) 및 최신 브라우저용 `icon.svg`
  - 출처: https://developer.mozilla.org/en-US/docs/Web/Manifest
- **홈 화면 아이콘 (PWA & iOS Apple Touch Icon)**: 
  - iOS Safari 홈 화면 추가: `apple-touch-icon.png` (180x180 픽셀, PNG, 투명 영역 없이 불투명 배경)
  - PWA / Android Manifest: `192x192.png`, `512x512.png`
  - 출처: https://developer.apple.com/library/archive/documentation/AppleApplications/Reference/SafariWebContent/ConfiguringWebApplications/ConfiguringWebApplications.html
- **소셜 공유 (OG 및 카카오톡/네이버) 썸네일**:
  - Open Graph 표준 미리보기 (`/api/og` 동적 생성 포함): **1200x630 픽셀** (비율 1.91:1, PNG/JPG, 용량 1MB 이하 권장)
  - 카카오링크 메시지(피드/커스텀 템플릿 전용): **800x800 픽셀** (1:1 비율) 또는 **800x400 픽셀** (2:1 비율), 용량 500KB 이하
  - 출처: https://developers.facebook.com/docs/sharing/webmasters/
  - 출처: https://developers.kakao.com/docs/latest/ko/message/message-template

---

### 5) 영상 배경 이미지 규격 (720x1280 ffmpeg zoompan)
- **ffmpeg zoompan 원본 권장 해상도**: 최종 출력 영상이 720x1280 (9:16)일 때, ffmpeg `zoompan` 필터를 적용하면 원본 이미지를 크롭(Crop) 후 720x1280으로 확대·보간하므로 원본 이미지가 작으면 픽셀 깨짐이 발생합니다. 확대 배수(기본 1.5x~2x)를 고려하여 최소 **1440x2560 픽셀 이상**의 고해상도 PNG/JPEG 사용이 필수입니다.
  - 출처: https://ffmpeg.org/ffmpeg-filters.html#zoompan
- **권장 배수 및 이유**: zoompan 필터의 기본 Zoom factor(1.5x 확대) 적용 시 최소 1080x1920 해상도가 필요하며, 2x 확대 조작이나 대각선 이동(Pan) 시 선명도를 유지하려면 **2배수(1440x2560)** 원본이 적합합니다.
  - 출처: https://creatomate.com/blog/how-to-zoom-images-and-videos-using-ffmpeg
- **자막 안전 영역 (Safe Zone)**: 인스타그램 릴스, 틱톡, 카카오 인앱 브라우저 등의 UI 오버레이(상단 헤더, 하단 계정/캡션/버튼)에 자막이 가려지지 않도록 **상단 최소 1080px, 하단 최소 320px, 좌우 최소 60~120px 여백**을 두고, 화면 중앙 80% 영역 내에 자막 두 줄을 배치해야 합니다.
  - 출처: https://developers.facebook.com/docs/instagram-api/guides/reels

---

### 6) Vercel + Next.js 최적화 & Supabase Storage CORS
- **Next.js `<Image />` 최적화**: `next.config.js`의 `deviceSizes` 및 `imageSizes` 설정을 통해 모바일 기기별 맞춤형 WebP/AVIF 리사이징 에셋을 자동 생성 및 캐싱합니다.
  - 출처: https://nextjs.org/docs/app/api-reference/components/image
- **정적 에셋 & 서버리스 용량 제한**: Vercel Serverless Function 및 Route Handler의 Request/Response Body 제한은 **4.5MB**입니다. 10초 MP4 영상 파일 업로드/다운로드 처리 시 413(Payload Too Large) 에러를 방지하기 위해 Server Action 대신 클라이언트 직접 업로드(Direct Upload) 패턴을 적용해야 합니다.
  - 출처: https://vercel.com/docs/functions/serverless-functions/runtimes#request-body-size
- **Supabase Storage 공개 URL & CORS**: ffmpeg 서버, 캔버스(Canvas), `/api/og` 동적 이미지 생성기에서 Supabase Storage에 저장된 배경 이미지를 `fetch`할 때 CORS 차단을 방지하려면 버킷 설정에서 `Access-Control-Allow-Origin: *` 또는 서비스 도메인을 허용해야 합니다.
  - 출처: https://supabase.com/docs/guides/storage/cors

---

### 우리가 준비할 에셋 체크리스트

1. `public/favicon.ico`
   - 규격: 16x16, 32x32, 48x48 픽셀 (멀티 레이어 ICO)
   - 용도: 브라우저 탭 기본 파비콘
2. `public/icon.svg`
   - 규격: 임의 벡터 크기 (SVG)
   - 용도: 모던 브라우저 반응형 파비콘
3. `public/apple-touch-icon.png`
   - 규격: 180x180 픽셀 (PNG, 불투명 배경)
   - 용도: iOS Safari '홈 화면에 추가' 아이콘
4. `public/icon-192.png`
   - 규격: 192x192 픽셀 (PNG)
   - 용도: PWA / Android 앱 아이콘
5. `public/icon-512.png`
   - 규격: 512x512 픽셀 (PNG)
   - 용도: PWA 스플래시 화면 아이콘
6. `public/og-default.png`
   - 규격: 1200x630 픽셀 (PNG 또는 JPG, 1MB 이하)
   - 용도: 기본 소셜 링크 미리보기(OG) 썸네일
7. `public/kakao-thumb.png`
   - 규격: 800x800 픽셀 (PNG 또는 JPG, 500KB 이하)
   - 용도: 카카오톡 메시지 템플릿 전용 썸네일
8. `public/assets/game/bg-[name].webp`
   - 규격: 720x1280~1080x1920 픽셀 (@2x 레티나 대응, WebP, 200KB 이하)
   - 용도: 모바일 웹 게임 내 화면 배경 이미지
9. `public/assets/game/ui-[name].png` (또는 `ui-spritesheet.png` + `ui-spritesheet.json`)
   - 규격: @2x/3x 대응 해상도 (PNG 투명 배경, 파일당 100KB 이하)
   - 용도: 게임 캐릭터, 스티커, 버튼, UI 구성요소
10. `supabase-storage/video-templates/bg-video-raw-[name].png` (또는 `.jpg`)
    - 규격: 1440x2560 픽셀 (9:16 세로 비율 2배수, PNG 또는 JPG)
    - 용도: ffmpeg zoompan 렌더링용 영상 원본 배경 이미지
11. `public/fonts/subtitle-font.woff2` (또는 `.ttf`)
    - 규격: WOFF2 또는 TTF 폰트 파일
    - 용도: ffmpeg drawtext 자막 인코딩 및 `/api/og` 동적 PNG 생성용 폰트 에셋
