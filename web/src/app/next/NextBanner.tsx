"use client";

import { useEffect, useRef } from "react";
import { sendHookEvent } from "@/lib/next_hook";
import { useLang } from "@/lib/i18n";

type Pos = { x: number; y: number; w: number; h: number };

// 1편 화면 위의 "NEXT #002" 예고 배너. 위치는 720x1280 무대 좌표(사장님이 조합판에서 맞춘 값)를 .play-box 비율로 환산한다.
// 누르면 같은 탭에서 /next?from=001 (예고+이메일 훅 페이지)로 간다.
export default function NextBanner({ pos, challengeId }: { pos: Pos; challengeId: string }) {
  const seen = useRef(false);
  const { lang } = useLang(); // 영어판은 영어 배너 이미지(렌더: tools/layout-editor/render_banner.py --lang en)
  useEffect(() => {
    if (seen.current) return;
    seen.current = true;
    sendHookEvent("next_banner_viewed", challengeId, "001");
  }, [challengeId]);
  /* eslint-disable @next/next/no-img-element */
  return (
    <a
      href="/next?from=001"
      data-testid="next-banner"
      aria-label="NEXT #002"
      onClick={() => sendHookEvent("next_banner_clicked", challengeId, "001")}
      style={{
        position: "absolute",
        zIndex: 20,
        left: `${((pos.x - pos.w / 2) / 720) * 100}%`,
        top: `${((pos.y - pos.h / 2) / 1280) * 100}%`,
        width: `${(pos.w / 720) * 100}%`,
        display: "block",
      }}
    >
      <img src={lang === "en" ? "/game/banner_next_ep_en.png" : "/game/banner_next_ep.png"} alt="" style={{ width: "100%", display: "block" }} />
    </a>
  );
  /* eslint-enable @next/next/no-img-element */
}
