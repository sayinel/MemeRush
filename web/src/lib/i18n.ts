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
    emailHelp: "이메일을 남기면 이 게임과 새 게임이 나오면 메일로 보내 드려요.",
    playNow: "지금 플레이",
    emailInput: "이메일 주소",
    emailLegal: "",
    emailNoAt: "@가 빠졌어요. 다시 입력해 주세요.",
    emailBad: "이메일 주소를 다시 확인해 주세요.",
    emailSent: "남겨 주셔서 고마워요. 메일로 보내 드릴게요",
    emailAgain: "한 판 더",
    emailFailed: "메일 저장이 안 됐어요. 다시 시도해 주세요.",
    emailRetry: "다시 시도",
    emailKeep: "입력한 내용은 그대로 남아 있어요.",
    emailSending: "보내는 중…",
    linkCopied: "링크를 복사했어요. 친구에게 보내세요.",
  },
  en: {
    tryAgain: "Try again",
    seeRank: "See my rank",
    emailMe: "Email me this game",
    share: "Share",
    emailHelp: "Leave your email and we'll send you this game, and new games when they come out.",
    playNow: "Play now",
    emailInput: "Email address",
    emailLegal: "",
    emailNoAt: "The @ is missing. Please check and try again.",
    emailBad: "Please check your email address.",
    emailSent: "Thanks! We'll email it to you.",
    emailAgain: "One more round",
    emailFailed: "Couldn't save your email. Please try again.",
    emailRetry: "Try again",
    emailKeep: "What you typed is still here.",
    emailSending: "Sending…",
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
