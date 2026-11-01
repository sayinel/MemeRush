"use client";

import { useEffect, useRef, useState, type CSSProperties } from "react";
import { DALGONA_EMAIL_HOOK_LAYOUT as L } from "@/game/layout_dalgona_email_hook";
import { captureSrc, useLang } from "@/lib/i18n";
import { hookSrc, nextTitleNo, sendHookEvent, type HookFrom } from "@/lib/next_hook";

const STAGE_W = 720;
const STAGE_H = 1280;

type Box = { x: number; y: number; w: number; h: number };
const box = (k: Box, bottom = false): CSSProperties => ({
  position: "absolute",
  left: k.x - k.w / 2,
  top: bottom ? k.y - k.h : k.y - k.h / 2,
  width: k.w,
  height: k.h,
});
const stroke = (px: number, color = "#14192E"): CSSProperties => ({ WebkitTextStroke: `${px}px ${color}`, paintOrder: "stroke fill" });
const center: CSSProperties = { display: "flex", alignItems: "center", justifyContent: "center", whiteSpace: "nowrap" };

// 시안(tools/layout-editor/screens/dalgona_email_hook.ts)을 720x1280 무대로 그대로 만들고, 화면 크기에 맞춰 줄인다(DalgonaGame 의 stageScale 방식).
export function HookStage({ from, challengeId, scale, onBack, backLabel }: { from: HookFrom; challengeId: string; scale: number; onBack: () => void; backLabel: string }) {
  const { lang, t } = useLang();
  const [email, setEmail] = useState("");
  const [state, setState] = useState<"input" | "invalid" | "sending" | "failed" | "sent">("input");
  const [invalidMsg, setInvalidMsg] = useState("");
  const focused = useRef(false);

  useEffect(() => {
    sendHookEvent("hook_viewed", challengeId, from);
  }, [from, challengeId]);

  async function submit() {
    const v = email.trim();
    if (!v.includes("@")) {
      setInvalidMsg(t.emailNoAt);
      return setState("invalid");
    }
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(v)) {
      setInvalidMsg(t.emailBad);
      return setState("invalid");
    }
    setState("sending");
    try {
      const res = await fetch("/api/subscribe", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email: v, lang, src: hookSrc(from, captureSrc()) }),
      });
      if (res.ok) {
        setState("sent");
        sendHookEvent("hook_email_submitted", challengeId, from);
      } else setState("failed");
    } catch {
      setState("failed");
    }
  }

  const sent = state === "sent";
  const bad = state === "invalid";
  const failed = state === "failed";
  const errText = bad ? invalidMsg : failed ? t.emailFailed : "";
  const heroSrc = sent ? "/game/worker_oc_laughing.png" : "/game/worker_oc_sweating.png";
  const sans = "var(--font-noto), Arial, sans-serif";

  /* eslint-disable @next/next/no-img-element */
  return (
    <div style={{ width: STAGE_W * scale, height: STAGE_H * scale, flex: "none" }} data-testid="hook-stage" data-state={state} data-from={from}>
      <div>
        <div
          data-testid="stage"
          style={{ width: STAGE_W, height: STAGE_H, transform: `scale(${scale})`, transformOrigin: "0 0", position: "relative", overflow: "hidden", backgroundImage: "url(/game/bg_dalgona_playground.webp)", backgroundSize: "cover", backgroundPosition: "center", fontFamily: sans }}
        >
          <button type="button" onClick={onBack} style={{ ...box(L.btn_back), ...center, fontFamily: sans, fontWeight: 700, fontSize: L.btn_back.font, color: "#fff", ...stroke(6) }}>
            ‹ {backLabel}
          </button>
          <div style={{ ...box(L.caption_top), ...center, fontFamily: '"Anton", Impact, sans-serif', fontSize: L.caption_top.font, color: "#fff", ...stroke(12) }}>
            NEXT&nbsp;<span style={{ color: "#ffd54a" }}>{nextTitleNo(from)}</span>
          </div>
          <div style={{ ...box(L.teaser_line), ...center, fontWeight: 700, fontSize: L.teaser_line.font, color: "#fff", ...stroke(8) }}>주인공이 달고나 앞에 섰다…</div>
          <img src="/game/dalgona_disc_umbrella.png" alt="" style={{ ...box(L.door), objectFit: "contain" }} />
          <img src={heroSrc} alt="" style={{ ...box(L.hero_peek, true), objectFit: "contain" }} />
          <div style={{ ...box(L.reward_line), ...center, fontWeight: 700, fontSize: L.reward_line.font, color: "#FEDE25", ...stroke(8) }}>깨뜨리지 않고 따낼 수 있을까?</div>

          {sent ? (
            <div role="status" style={{ ...box({ x: L.input.x, y: (L.input.y + L.btn_submit.y) / 2, w: L.input.w, h: 120 }), ...center, fontWeight: 900, fontSize: 38, color: "#fff", ...stroke(8) }}>
              다음 게임이 나오면 이 메일로 보내드려요
            </div>
          ) : (
            <form
              noValidate
              onSubmit={(e) => {
                e.preventDefault();
                if (state !== "sending") void submit();
              }}
            >
              {errText && (
                <div role="alert" style={{ ...box({ x: L.input.x, y: L.input.y - 62, w: L.input.w, h: 36 }), ...center, fontWeight: 700, fontSize: 26, color: "#ffd0d0", ...stroke(5) }}>
                  {errText}
                </div>
              )}
              <input
                type="email"
                data-clarity-mask="True"
                inputMode="email"
                autoComplete="email"
                value={email}
                placeholder="이메일 주소"
                aria-label="이메일 주소"
                aria-invalid={bad || failed}
                onFocus={() => {
                  if (!focused.current) {
                    focused.current = true;
                    sendHookEvent("hook_email_focus", challengeId, from);
                  }
                }}
                onChange={(e) => {
                  setEmail(e.target.value);
                  if (bad) setState("input");
                }}
                style={{ ...box(L.input), boxSizing: "border-box", padding: "0 24px", background: "#fff", border: `4px solid ${bad || failed ? "#d11" : "#14192E"}`, borderRadius: 18, fontFamily: sans, fontWeight: 700, fontSize: L.input.font, color: "#14192E", outline: "none" }}
              />
              <button
                type="submit"
                disabled={state === "sending"}
                style={{ ...box(L.btn_submit), boxSizing: "border-box", background: "#12803c", border: "4px solid #fff", borderRadius: 22, color: "#fff", fontFamily: sans, fontWeight: 900, fontSize: L.btn_submit.font, opacity: state === "sending" ? 0.6 : 1 }}
              >
                {state === "sending" ? t.emailSending : failed ? t.emailRetry : "다음 게임 메일로 받기"}
              </button>
              <div style={{ ...box(L.help), ...center, fontWeight: 500, fontSize: L.help.font, color: "#fff", ...stroke(5) }}>이메일을 남기면 이 게임과 새 게임 소식을 메일로 보내 드려요.</div>
            </form>
          )}
        </div>
      </div>
    </div>
  );
  /* eslint-enable @next/next/no-img-element */
}

// 1편 안에서 이메일을 받는 화면: /next 와 같은 훅 화면을 .play-box 폭에 맞춰 덮는다.
export function HookOverlay({ challengeId, onClose, lang }: { challengeId: string; onClose: () => void; lang: string }) {
  const ref = useRef<HTMLDivElement>(null);
  const [scale, setScale] = useState(0.5);
  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const fit = () => setScale(el.clientWidth / STAGE_W);
    fit();
    const ro = new ResizeObserver(fit);
    ro.observe(el);
    return () => ro.disconnect();
  }, []);
  return (
    <div ref={ref} className="absolute inset-0 z-30 overflow-hidden bg-black" role="dialog" aria-modal="true" data-testid="email-screen">
      <HookStage from="001" challengeId={challengeId} scale={scale} onBack={onClose} backLabel={lang === "ko" ? "이전" : "Back"} />
    </div>
  );
}
