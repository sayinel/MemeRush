// Input guards shared by the API routes. Pure functions (no server-only import) so tests/*.test.mjs can load them directly.

// ---- /api/events -------------------------------------------------------------------------------------------------

/** Event types the browser may send. Server-side events are written by their own routes. */
export const CLIENT_EVENTS = new Set(["challenge_link_opened", "video_downloaded", "native_share_invoked", "challenge_link_copied"]);

/** Upper bound for the serialized `meta` object (bytes, UTF-8). The client only sends `{ src }` today. */
export const EVENT_META_MAX_BYTES = 2048;
/** Upper bound for the whole request body; anything larger is refused before parsing. */
export const EVENT_BODY_MAX_BYTES = 4096;

export type MetaCheck = { ok: true; meta: Record<string, unknown> | undefined } | { ok: false; status: 413; error: string };

export function checkEventMeta(raw: unknown): MetaCheck {
  // Non-objects were always dropped silently (same as before this guard); keep that so old clients still log.
  if (raw === undefined || raw === null || typeof raw !== "object" || Array.isArray(raw)) return { ok: true, meta: undefined };
  const bytes = new TextEncoder().encode(JSON.stringify(raw)).length;
  if (bytes > EVENT_META_MAX_BYTES) return { ok: false, status: 413, error: "meta too large" };
  return { ok: true, meta: raw as Record<string, unknown> };
}

// ---- nicknames ---------------------------------------------------------------------------------------------------

export const NICKNAME_MAX = 20;

// Control characters (Cc), format characters (Cf: bidi overrides U+202A-202E/2066-2069, zero-width U+200B-200D,
// U+FEFF, soft hyphen ...), line/paragraph separators, and variation selectors.
const INVISIBLE = /[\p{Cc}\p{Cf}\p{Zl}\p{Zp}\u{FE00}-\u{FE0F}\u{E0100}-\u{E01EF}\u3164\uFFA0\u115F\u1160]/gu;

// Minimal block list: impersonation of the operator and common profanity (EN/KO). Matched as substrings on a
// folded form (lower case, digits-as-letters, punctuation and spaces removed), so "A.d.m.1.n" is caught too.
const BLOCKED = [
  // impersonation
  "admin", "administrator", "official", "moderator", "memerush", "superagents", "staff", "system",
  "관리자", "운영자", "운영진", "공식", "밈러시", "어드민",
  // profanity / slurs (EN)
  "fuck", "shit", "bitch", "cunt", "nigger", "nigga", "faggot", "retard", "whore", "slut", "dick", "pussy",
  // profanity (KO)
  "씨발", "시발", "씨바", "ㅅㅂ", "ㅆㅂ", "병신", "ㅂㅅ", "좆", "지랄", "개새끼", "새끼", "니미", "느금", "애미", "애비", "미친놈", "미친년", "썅",
];

const LEET: Record<string, string> = { "0": "o", "1": "i", "3": "e", "4": "a", "5": "s", "7": "t", "@": "a", "$": "s", "!": "i" };

function fold(s: string): string {
  return s
    .toLowerCase()
    .replace(/[013457@$!]/g, (c) => LEET[c] ?? c)
    .replace(/[^\p{L}\p{N}]/gu, "");
}

const AUTO_NAME = /^Player-[A-Z0-9]{1,4}$/;

export type NicknameCheck = { ok: true; nickname: string } | { ok: false; error: string };

/** Normalizes a user-supplied nickname and rejects invisible tricks, bad length and blocked words. */
export function checkNickname(raw: unknown): NicknameCheck {
  if (typeof raw !== "string") return { ok: false, error: "nickname must be 1-20 characters" };
  const cleaned = raw
    .normalize("NFKC")
    .replace(INVISIBLE, "")
    .replace(/\s+/gu, " ")
    .trim();
  const length = [...cleaned].length;
  if (length < 1 || length > NICKNAME_MAX) return { ok: false, error: "nickname must be 1-20 characters" };
  if (!/[\p{L}\p{N}]/u.test(cleaned)) return { ok: false, error: "nickname needs a letter or digit" };
  // The client's own quiet name (Player- + 4 random base36 chars) is never refused, so a rare random suffix that
  // folds into a blocked word (e.g. "5H1T") cannot stop a player from starting a game.
  if (AUTO_NAME.test(cleaned)) return { ok: true, nickname: cleaned };
  const folded = fold(cleaned);
  if (BLOCKED.some((w) => folded.includes(w))) return { ok: false, error: "nickname not allowed" };
  return { ok: true, nickname: cleaned };
}
