// 2편 예고 훅(배너 -> /next 페이지) 공용 순수 함수와 이벤트 보내기. 이메일·개인정보는 이벤트에 넣지 않는다.

/** 1편(TOAST CAM)에서 오면 "001", 달고나(2편)에서 오면 "002". 그 밖의 값은 "001"로 본다. */
export type HookFrom = "001" | "002";

export function normalizeFrom(raw: string | null | undefined): HookFrom {
  return raw === "002" ? "002" : "001";
}

/** 예고 제목 번호: from=001 -> "#002", from=002 -> "#003". */
export function nextTitleNo(from: HookFrom): string {
  return from === "002" ? "#003" : "#002";
}

/** /api/subscribe 의 src 값. 서버가 [\w.-] 40자로 거르므로 그대로 통과한다. */
export function hookSrc(from: HookFrom, channel?: string | null): string {
  // 유입 채널(?src=)을 뒤에 붙여 이메일 등록이 어느 채널에서 왔는지 남긴다: hook_from_001.sns_kr
  const base = `hook_from_${from}`;
  const ch = channel ? channel.replace(/[^\w.-]/g, "").slice(0, 40) : "";
  return ch ? `${base}.${ch}`.slice(0, 40) : base;
}

/** 이벤트 meta: from 과 variant 만. */
export function hookMeta(from: HookFrom): { from: HookFrom; variant: "A" } {
  return { from, variant: "A" };
}

/** /api/events 는 알려진 챌린지 id 가 있어야 받는다. /next 에는 챌린지가 없어 1편 id 를 쓴다. */
export const HOOK_EVENT_CHALLENGE = "2026-10-25";

export type HookEventType = "next_banner_viewed" | "next_banner_clicked" | "hook_viewed" | "hook_email_focus" | "hook_email_submitted";

/** 보내고 잊는 이벤트(실패해도 화면은 그대로). keepalive 라 페이지를 떠나도 나간다. */
export function sendHookEvent(type: HookEventType, challengeId: string, from: HookFrom): void {
  try {
    void fetch("/api/events", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ type, challengeId, meta: hookMeta(from) }),
      keepalive: true,
    }).catch(() => {});
  } catch {
    /* ignore */
  }
}
