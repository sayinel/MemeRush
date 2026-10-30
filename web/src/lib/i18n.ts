"use client";

import { useCallback, useEffect, useState } from "react";

// Result/ranking copy lives here. ko = Korean target (English screen, action buttons in Korean), en = global.
export type Lang = "ko" | "en";

export const STRINGS = {
  ko: {
    tryAgain: "다시 도전",
    seeRank: "내 순위 보기",
    emailMe: "밈 게임 메일로 받기",
    share: "공유하기",
    emailHelp: "이 게임을 메일로 받고, 새로운 게임알림을 받으세요.",
    playNow: "지금 플레이",
    emailTitle: "메일로 받기",
    emailSoon: "곧 열립니다. 지금은 아무것도 저장되지 않습니다.",
    emailClose: "닫기",
    emailPlaceholder: "이메일 주소",
    linkCopied: "링크를 복사했어요. 친구에게 보내세요.",
  },
  en: {
    tryAgain: "Try again",
    seeRank: "See my rank",
    emailMe: "Email me this game",
    share: "Share",
    emailHelp: "Get this game by email, and get alerts when new games come out.",
    playNow: "Play now",
    emailTitle: "Email me this game",
    emailSoon: "Coming soon. Nothing is saved yet.",
    emailClose: "Close",
    emailPlaceholder: "Your email",
    linkCopied: "Link copied. Send it to a friend.",
  },
} as const;

export type Strings = (typeof STRINGS)[Lang];

const LANG_KEY = "mr_lang";
const SRC_KEY = "mr_src";

const isLang = (v: unknown): v is Lang => v === "ko" || v === "en";

// Order: URL ?lang= > localStorage > browser language (ko* -> ko) > en.
export function resolveLang(search: string, stored: string | null, navLang: string): Lang {
  const q = new URLSearchParams(search).get("lang");
  if (isLang(q)) return q;
  if (isLang(stored)) return stored;
  return navLang.toLowerCase().startsWith("ko") ? "ko" : "en";
}

function readStored(key: string, storage: "local" | "session"): string | null {
  try {
    return (storage === "local" ? window.localStorage : window.sessionStorage).getItem(key);
  } catch {
    return null;
  }
}

function writeStored(key: string, value: string, storage: "local" | "session") {
  try {
    (storage === "local" ? window.localStorage : window.sessionStorage).setItem(key, value);
  } catch {
    // Storage blocked: the language still works for this visit.
  }
}

// Server render and first paint use "en"; the real language is resolved once on the client (no hydration mismatch).
export function useLang(): { lang: Lang; setLang: (l: Lang) => void; t: Strings } {
  const [lang, setLangState] = useState<Lang>("en");
  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setLangState(resolveLang(window.location.search, readStored(LANG_KEY, "local"), navigator.language || ""));
  }, []);
  const setLang = useCallback((l: Lang) => {
    setLangState(l);
    writeStored(LANG_KEY, l, "local");
  }, []);
  return { lang, setLang, t: STRINGS[lang] };
}

// Traffic source (?src=sns_kr, community_global ...): kept for the visit and sent as meta on challenge_link_opened.
export function captureSrc(): string | null {
  const q = new URLSearchParams(window.location.search).get("src");
  const clean = q?.replace(/[^\w.-]/g, "").slice(0, 40);
  if (clean) writeStored(SRC_KEY, clean, "session");
  return clean || readStored(SRC_KEY, "session");
}
