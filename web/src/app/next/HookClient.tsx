"use client";

import { useEffect, useState } from "react";
import { HookStage } from "./HookStage";
import { useLang } from "@/lib/i18n";
import { HOOK_EVENT_CHALLENGE, type HookFrom } from "@/lib/next_hook";

// /next: 훅 화면 한 장을 화면 크기에 맞춰 줄여 보여 준다(DalgonaGame 의 stageScale 방식).
export default function HookClient({ from }: { from: HookFrom }) {
  const { lang } = useLang();
  const [scale, setScale] = useState(0.5);
  useEffect(() => {
    const fit = () => setScale(Math.min(window.innerWidth / 720, window.innerHeight / 1280));
    fit();
    window.addEventListener("resize", fit);
    return () => window.removeEventListener("resize", fit);
  }, []);
  function back() {
    if (window.history.length > 1) window.history.back();
    else window.location.href = "/";
  }
  return (
    <main className="relative flex min-h-dvh flex-col items-center bg-black text-white" data-testid="hook-page">
      <HookStage from={from} challengeId={HOOK_EVENT_CHALLENGE} scale={scale} onBack={back} backLabel={lang === "ko" ? "이전" : "Back"} />
    </main>
  );
}
