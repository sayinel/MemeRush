# 리서치 원문: 에셋 작업 조건(용량, 크기, 폴더, 한도)

조사일 2026-10-24(핏). 검색 연동 AI 리서치 원문이며 공식 문서로 대조하기 전이다. 가이드에 쓰인 값은 `ASSET_GUIDE.md`에서 확정값과 시작값으로 나뉘어 있다.

---

### 1) 용량 예산
- **첫 로딩 총 용량 상한**: 초기 실행 시 필요한 핵심 자원(HTML/JS/초기 이미지)은 **1~2MB 이하**로 제한하는 것을 권장합니다.
- **이미지 1장당 상한**: 세로 배경 **150~200KB 이하**, 스프라이트 아틀라스 **300KB 이하**, 소품 스티커 **50KB 이하** 권장.
- **느린 4G(1.6Mbps / 200KB/s) 획득 용량**: 3초 이내 약 **600KB**, 5초 이내 약 **1.0MB** 수신 가능.
- **Google LCP 기준과 이미지**: LCP(Largest Contentful Paint)는 화면 내 가장 큰 요소(배경 이미지 등)의 렌더링 완료 시간 **2.5초 이내**를 목표로 합니다. LCP 이미지는 Lazy Loading을 피하고 우선 로드(Preload)해야 합니다.
- **출처**: https://web.dev/articles/lcp / https://web.dev/articles/performance-budgets-101

### 2) 이미지 메모리
- **WebGL 텍스처 VRAM 계산**: `가로px × 세로px × 4 Byte` (RGBA8888 기준, 예: 2048×2048 크기 텍스처 = **16MB VRAM** 점유).
- **모바일 최대 텍스처 크기**: **2048×2048 px 권장**. 보급형 안드로이드 기기는 4096×4096 지원 시에도 VRAM 부족으로 브라우저 탭 튕김이나 WebGL 컨텍스트 손실이 발생합니다.
- **스프라이트 아틀라스 크기 및 이유**: **2048×2048 px 1~2장으로 분할**. 개별 이미지를 하나의 텍스처로 묶어 GPU Draw Call과 텍스처 바인딩 교체 횟수를 줄이기 위함입니다.
- **2의 거듭제곱(POT) 필요성**: 최신 WebGL은 NPOT(Non-Power of Two)를 지원하지만, Mipmapping, Tiling, GPU 메모리 정렬 및 하위 호환성을 위해 POT(512, 1024, 2048) 적용이 권장됩니다.
- **출처**: https://phaser.io/news/2023/11/phaser-360-released / https://webglreport.com

### 3) 파일 형식과 압축 도구
- **PNG 투명 스프라이트 압축**: `pngquant`를 사용한 손실 양자화(RGBA32 → 8비트 색상표+알파)로 60~80% 용량 절감 후 `oxipng`로 무손실 재압축.
- **WebP·AVIF 및 인앱 브라우저 호환**: 둘 다 투명도를 지원합니다. WebP는 인스타그램/틱톡 인앱 브라우저 포함 **97%+** 지원으로 매우 안전하며, AVIF는 약 **94%** 지원합니다.
- **사진형 배경 WebP 품질**: **Quality 75~85** 설정 시 화질 손상 없이 최적의 압축률 제공.
- **무료 CLI 도구 사용 예**:
  - `sharp`: `npx sharp-cli -i bg.png -o bg.webp --quality 80`
  - `squoosh-cli`: `npx @squoosh/cli --webp '{"quality":80}' bg.png`
  - `pngquant`: `pngquant --quality=65-80 --ext .png --force sprite.png`
  - `ImageMagick`: `magick convert bg.jpg -quality 80 bg.webp`
- **출처**: https://caniuse.com/webp / https://caniuse.com/avif

### 4) 폴더 구조와 이름 규칙
- **`public/` vs `src/` import**: `public/` 에셋은 빌드 변환 없이 고정 URL로 정적 제공되며 기본 캐시 헤더가 짧습니다(`max-age=0`). `src/` import 파일은 빌더가 해시 파일명(`image.8f2816bd.png`)을 생성하여 영구 캐시(`immutable`)가 적용됩니다.
- **게임 에셋 관례 폴더**: `public/assets/game/bg/`, `sprites/`, `ui/`, `video/`
- **파일 이름 규칙**: 소문자-하이픈(kebab-case) 사용 (예: `bg-main.webp`), 고해상도 대응 시 `@2x` 접미사 사용.
- **Phaser와 폴더 관계**: Phaser의 `this.load.atlas()`는 HTTP URL 기반으로 동적 수신하므로, 고정 경로를 제공하는 `public/` 폴더에 배치하고 JSON 설정 파일과 매핑합니다.
- **출처**: https://nextjs.org/docs/app/building-your-application/optimizing/static-assets

### 5) 저장소와 배포 한도
- **GitHub 한도**: 단일 파일 **100MB 초과 푸시 차단**, 저장소 전체 **1GB 이하 권장** (5GB 초과 시 지원팀 경고). 100MB 초과 파일은 Git LFS 사용 필수.
- **Vercel 정적 배포 한도**: CLI 정적 파일 업로드 한도 **Hobby 100MB / Pro 1GB**, 전체 정적 출력 한도 **5GB**.
- **Vercel 함수 한도 & ffmpeg**: Serverless Function 번들 크기 제한은 **250MB**. ffmpeg 바이너리(`ffmpeg-static` 약 76MB) 포함은 가능하나, 함수 실행 시간 제한(Hobby 10~15초)과 요청/응답 바디 제한(4.5MB)으로 인해 서버리스 내 ffmpeg 영상 인코딩은 비권장되며 외부 서비스 또는 Supabase Edge/Worker 분리가 필요합니다.
- **외부 CDN/Storage 이관 기준**: 동적 사용자 업로드 파일, 10초 비디오 원본(수MB 이상), Next.js 빌드 용량을 압박하는 에셋은 Supabase Storage로 분리합니다.
- **출처**: https://docs.github.com/en/repositories/working-with-files/managing-large-files / https://vercel.com/docs/functions/limits

### 6) 캐시
- **Cache-Control 권장값**: 해시나 버전이 포함된 정적 파일은 `public, max-age=31536000, immutable` 적용.
- **Supabase Storage 공개 버킷**: Public 버킷 자원은 CDN을 통해 글로벌 엣지에 자동 캐싱됩니다. 업로드 시 `cacheControl: '3600'`(1시간) 또는 `'31536000'`(1년) 헤더를 직접 설정할 수 있습니다.
- **구형 캐시 방지(Cache Busting)**: 파일 변경 시 파일명에 버전/해시를 부여하거나(`bg-main-v2.webp`), URL 뒤에 쿼리 스트링(`?v=2`)을 추가하여 무효화합니다.
- **출처**: https://supabase.com/docs/guides/storage/cdn

### 7) 해상도·DPR
- **세로 게임 기준 해상도**: 논리 해상도 **720×1280 px (9:16 비율)** 기준 설계.
- **DPR 에셋 대응**: **2x DPR** (원본 해상도 1440×2560 px 기반 에셋을 720×1280에 맞게 압축 수신) 사용이 보급형 스마트폰의 VRAM 점유율과 렌더링 선명도 간 최고의 가성비를 제공합니다 (3x는 VRAM 과다 사용).
- **Phaser Scale Manager 및 안전 영역**:
  - `Phaser.Scale.ENVELOP` 모드(화면 전체를 여백 없이 채움) 적용.
  - 배경 이미지는 **720×1600 px (9:20 비율)**로 제작하되, 핵심 게임 요소를 중앙 **720×1280 px (안전 영역, Safe Area)** 내에 배치하여 긴 화면 폰(9:20)에서도 화면 상하단 잘림 없이 꽉 차게 렌더링합니다.
- **출처**: https://phaser.io/news/2023/11/phaser-360-released

---

### 우리가 정할 값

1. **세로 배경 이미지**
   - **최대 용량**: 200KB 이하
   - **크기/해상도**: 720×1600 px (중앙 720×1280 px 안전 영역)
   - **형식**: WebP (Quality 80)
   - **저장 폴더**: `public/assets/game/bg/`
   - **파일명 예시**: `bg-main-v1.webp`

2. **캐릭터 투명 스프라이트 (아틀라스)**
   - **최대 용량**: 한 장당 300KB 이하
   - **크기/해상도**: 2048×2048 px 이하 (POT 규격)
   - **형식**: 양자화된 PNG (PNG-8 with Alpha) 또는 WebP
   - **저장 폴더**: `public/assets/game/sprites/`
   - **파일명 예시**: `char-main-atlas.png`, `char-main-atlas.json`

3. **소품 스티커 및 UI 에셋**
   - **최대 용량**: 개별 50KB 이하
   - **크기/해상도**: 128×128 px ~ 512×512 px
   - **형식**: WebP (투명 지원) 또는 PNG
   - **저장 폴더**: `public/assets/game/ui/`
   - **파일명 예시**: `prop-sticker-star.webp`

4. **OG 이미지 (SNS 공유용)**
   - **최대 용량**: 300KB 이하
   - **크기/해상도**: 1200×630 px (1.91:1 표준 비율)
   - **형식**: PNG 또는 JPEG
   - **저장 폴더**: `public/assets/og/`
   - **파일명 예시**: `og-share-main.png`

5. **파비콘 및 웹 앱 아이콘**
   - **최대 용량**: 30KB 이하
   - **크기/해상도**: 512×512 px (PNG), 32×32 px (ICO)
   - **형식**: PNG, ICO
   - **저장 폴더**: `public/`
   - **파일명 예시**: `icon-512.png`, `favicon.ico`

6. **서버 ffmpeg 비디오 에셋 (렌더링 결과물)**
   - **최대 용량**: 5MB 이하 (10초 세로 비디오)
   - **크기/해상도**: 720×1280 px
   - **형식**: MP4 (H.264 / AAC)
   - **저장 위치**: Supabase Storage 버킷 (`game-videos`)
   - **파일명 예시**: `videos/render-20261024-001.mp4`
