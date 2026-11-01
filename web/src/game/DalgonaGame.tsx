"use client";

// 개발용 시제품: 밈러시 2편 달고나 뽑기 (outline_trace 틀). 서버·API 없이 로컬 판정만 쓴다.
// 로직은 src/game/dalgona_logic.ts (순수 함수, 시험 tests/dalgona_logic.test.mjs).

import { useEffect, useRef, useState } from "react";
import {
  DEFAULT_TOLERANCE,
  MAX_CRACKS,
  SHAPE_LIMIT_MS,
  SHAPE_ORDER,
  distToPolyline,
  judgeRound,
  shapeOutline,
  summarizeSession,
  validateHumanTrace,
  type RoundResult,
  type SessionSummary,
  type ShapeId,
  type TracePt,
} from "./dalgona_logic";

const W = 400;
const H = 400;
const SHAPE_NAME: Record<ShapeId, string> = { circle: "원", triangle: "삼각형", star: "별", heart: "하트", umbrella: "우산" };

type Phase = "ready" | "playing" | "between" | "done";

// 게임 상태는 ref 하나에 두고(캔버스 루프가 읽음), 화면에 필요한 값만 state로 복사한다.
interface G {
  phase: Phase;
  round: number;
  trace: TracePt[];
  t0: number | null;
  live: RoundResult | null;
  rounds: RoundResult[];
  valid: boolean;
  leftMs: number; // 남은 시간(그리기용)
  lim: number; // 이 라운드 제한 시간
  prevCracks: number;
  lastBuzz: number;
}
const fresh = (): G => ({
  phase: "ready",
  round: 0,
  trace: [],
  t0: null,
  live: null,
  rounds: [],
  valid: true,
  leftMs: 0,
  lim: 0,
  prevCracks: 0,
  lastBuzz: 0,
});

// 긴박감 장치: 휴대폰 진동(지원하는 기기만, 안 되면 조용히 무시)
function buzz(pattern: number | number[]) {
  try {
    if (typeof navigator !== "undefined" && typeof navigator.vibrate === "function") navigator.vibrate(pattern);
  } catch {
    /* 진동 미지원 */
  }
}

// 달고나 원판은 사장님이 컨펌한 그림을 그대로 보여 준다(홈 경로도 이 그림에서 뽑았다). 그림이 아직 안 불러와졌으면 선으로 대신 그린다.
const DISC_SRC: Partial<Record<ShapeId, string>> = {
  heart: "/game/dalgona_disc_heart_confirmed.png",
  star: "/game/dalgona_disc_star_confirmed.png",
  umbrella: "/game/dalgona_disc_umbrella_confirmed.png",
};
const DISC_IMG = new Map<ShapeId, HTMLImageElement>();
function discImage(shape: ShapeId): HTMLImageElement | null {
  if (typeof window === "undefined") return null;
  const src = DISC_SRC[shape];
  if (!src) return null;
  let img = DISC_IMG.get(shape);
  if (!img) {
    img = new Image();
    img.src = src;
    DISC_IMG.set(shape, img);
  }
  return img.complete && img.naturalWidth > 0 ? img : null;
}

// 시험 기록: 내부망(.ts.net)이나 로컬에서 열었을 때만 사장님 PC의 작은 수집기로 보낸다(운영 주소에서는 아무것도 보내지 않는다).
// 목적은 '사람이 잘하는 건지 게임이 빠듯하게 설계된 건지'를 숫자(통과율, 걸린 시간)로 가리는 것이다.
function logRound(shape: ShapeId, limitMs: number, elapsedMs: number, r: RoundResult) {
  try {
    const h = location.hostname;
    const tail = h.endsWith(".ts.net");
    if (!tail && h !== "localhost" && h !== "127.0.0.1") return;
    const body = JSON.stringify({
      t: new Date().toISOString(),
      shape,
      limitMs,
      usedMs: Math.round(r.complete && r.completeAtMs !== null ? r.completeAtMs : elapsedMs),
      leftMs: r.timeLeftMs,
      cracks: r.cracks,
      accuracy: r.accuracy,
      coverage: Math.round(r.coverage * 1000) / 1000,
      complete: r.complete,
      timedOut: r.timedOut,
      broken: r.broken,
      ua: navigator.userAgent.slice(0, 80),
    });
    void fetch(`${location.protocol}//${h}:${tail ? 8444 : 3928}/log`, { method: "POST", mode: "no-cors", body, keepalive: true }).catch(() => {});
  } catch {
    /* 기록은 없어도 게임에 영향 없음 */
  }
}


const OUTLINE_CACHE = new Map<ShapeId, ReturnType<typeof shapeOutline>>();
function outlineOf(shape: ShapeId) {
  let o = OUTLINE_CACHE.get(shape);
  if (!o) {
    o = shapeOutline(shape);
    OUTLINE_CACHE.set(shape, o);
  }
  return o;
}

function nearestPoint(trace: TracePt[], tMs: number): { x: number; y: number } {
  let best: TracePt | undefined = trace[0];
  for (const p of trace) if (!best || Math.abs(p.t - tMs) < Math.abs(best.t - tMs)) best = p;
  return best ?? { x: 0.5, y: 0.5 };
}

function drawAll(c: HTMLCanvasElement, g: G) {
  const ctx = c.getContext("2d");
  if (!ctx) return;
  const res = g.live;
  const shake = res && res.cracks === 2 && !res.broken ? (Math.random() - 0.5) * 3 : 0;
  ctx.clearRect(0, 0, W, H);
  ctx.save();
  ctx.translate(shake, shake);
  // 달고나 원판
  ctx.fillStyle = "#c87c2e"; // 사장님 2026-11-01 확정 달고나 색
  ctx.beginPath();
  ctx.arc(W / 2, H / 2, 192, 0, Math.PI * 2);
  ctx.fill();
  ctx.strokeStyle = "#fff";
  ctx.lineWidth = 6;
  ctx.stroke();
  // 모양 홈
  const o = outlineOf(SHAPE_ORDER[Math.min(g.round, 2)]);
  const umbImg = discImage(SHAPE_ORDER[Math.min(g.round, 2)]);
  if (umbImg) ctx.drawImage(umbImg, W / 2 - 192, H / 2 - 192, 384, 384);
  ctx.strokeStyle = "#5b3612";
  ctx.lineWidth = 7;
  ctx.lineJoin = "round";
  if (!umbImg) {
    ctx.beginPath();
    o.forEach((p, i) => (i ? ctx.lineTo(p.x * W, p.y * H) : ctx.moveTo(p.x * W, p.y * H)));
    ctx.stroke();
  }
  // 시작점
  ctx.fillStyle = "#2ecc71";
  ctx.beginPath();
  ctx.arc(o[0].x * W, o[0].y * H, 8, 0, Math.PI * 2);
  ctx.fill();
  // 마지막 3초: 화면 한가운데에 큰 카운트다운(사장님 2026-11-01). 원판 그림 위, 바늘 자국 아래에 그려 홈이 가려지지 않게 맑게 띄운다.
  if (g.phase === "playing" && g.lim > 0 && g.leftMs <= 3000) {
    const sec = Math.max(1, Math.ceil(g.leftMs / 1000));
    const pulse = 0.5 + 0.5 * Math.sin(performance.now() / 80);
    ctx.save();
    ctx.font = `bold ${230 + pulse * 30}px sans-serif`;
    ctx.textAlign = "center";
    ctx.textBaseline = "middle";
    ctx.lineJoin = "round";
    ctx.lineWidth = 10;
    ctx.strokeStyle = `rgba(255,255,255,${0.35 + pulse * 0.2})`;
    ctx.strokeText(String(sec), W / 2, H / 2 + 10);
    ctx.fillStyle = `rgba(230,30,20,${0.45 + pulse * 0.3})`;
    ctx.fillText(String(sec), W / 2, H / 2 + 10);
    ctx.restore();
  }
  // 바늘 자국(궤적)
  if (g.trace.length > 1) {
    ctx.strokeStyle = "#111";
    ctx.lineWidth = 3;
    ctx.beginPath();
    g.trace.forEach((p, i) => (i ? ctx.lineTo(p.x * W, p.y * H) : ctx.moveTo(p.x * W, p.y * H)));
    ctx.stroke();
  }
  // 균열: 생긴 자리에서 뻗는 흰 선
  if (res) {
    ctx.strokeStyle = "#fff";
    ctx.lineWidth = 3;
    res.crackAtMs.forEach((ms, k) => {
      const p = ms >= SHAPE_LIMIT_MS[SHAPE_ORDER[Math.min(g.round, 2)]] ? { x: 0.5, y: 0.5 } : nearestPoint(g.trace, ms);
      const dir = k % 2 ? -1 : 1;
      ctx.beginPath();
      ctx.moveTo(p.x * W, p.y * H);
      for (let s = 1; s <= 4 + k * 2; s++) ctx.lineTo(p.x * W + (s % 2 ? 12 : -9) * s * 0.8, p.y * H + dir * 15 * s * 0.8);
      ctx.stroke();
    });
    if (res.broken) {
      ctx.beginPath();
      ctx.moveTo(W / 2 - 150, H / 2 - 120);
      ctx.lineTo(W / 2 - 20, H / 2 - 10);
      ctx.lineTo(W / 2 - 60, H / 2 + 40);
      ctx.lineTo(W / 2 + 110, H / 2 + 150);
      ctx.stroke();
    }
  }
  // 도화선: 위쪽 선이 시간에 따라 타들어 간다
  if (g.phase === "playing" && g.lim > 0) {
    const ratio = Math.max(0, Math.min(1, g.leftMs / g.lim));
    const x1 = 16 + (W - 32) * ratio;
    ctx.save();
    ctx.lineCap = "round";
    ctx.lineWidth = 6;
    ctx.strokeStyle = "rgba(255,255,255,0.25)";
    ctx.beginPath();
    ctx.moveTo(16, 14);
    ctx.lineTo(W - 16, 14);
    ctx.stroke();
    ctx.strokeStyle = ratio < 0.3 ? "#ff4d2e" : "#ffd24a";
    ctx.beginPath();
    ctx.moveTo(16, 14);
    ctx.lineTo(x1, 14);
    ctx.stroke();
    ctx.fillStyle = "#fff6c8";
    ctx.beginPath();
    ctx.arc(x1, 14, 5 + Math.random() * 3, 0, Math.PI * 2);
    ctx.fill();
    ctx.restore();
    // 마지막 3초: 화면 가장자리가 붉게 맥박
    if (g.leftMs <= 3000) {
      const pulse = 0.5 + 0.5 * Math.sin(performance.now() / 90);
      const grd = ctx.createRadialGradient(W / 2, H / 2, H * 0.28, W / 2, H / 2, H * 0.72);
      grd.addColorStop(0, "rgba(255,0,0,0)");
      grd.addColorStop(1, `rgba(255,0,0,${0.25 + pulse * 0.3})`);
      ctx.fillStyle = grd;
      ctx.fillRect(0, 0, W, H);
    }
  }
  // 시간 초과: 폭탄이 터진다
  if (res && !res.complete && !res.broken && g.phase === "done") {
    ctx.fillStyle = "rgba(255,120,0,0.35)";
    ctx.fillRect(0, 0, W, H);
    ctx.font = "170px sans-serif";
    ctx.textAlign = "center";
    ctx.textBaseline = "middle";
    ctx.fillText("💥", W / 2, H / 2);
  }
  ctx.restore();
}

export default function DalgonaGame() {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const gRef = useRef<G>(fresh());
  const [ui, setUi] = useState<{ phase: Phase; round: number; leftMs: number; live: RoundResult | null; rounds: RoundResult[]; valid: boolean }>({
    phase: "ready",
    round: 0,
    leftMs: SHAPE_LIMIT_MS[SHAPE_ORDER[0]],
    live: null,
    rounds: [],
    valid: true,
  });

  const sync = (leftMs: number) => {
    const g = gRef.current;
    setUi({ phase: g.phase, round: g.round, leftMs, live: g.live, rounds: g.rounds, valid: g.valid });
  };

  // 한 개의 루프가 계속 돌며 시계, 실시간 판정, 그리기를 한다.
  useEffect(() => {
    let raf = 0;
    const tick = () => {
      const g = gRef.current;
      let left = SHAPE_LIMIT_MS[SHAPE_ORDER[Math.min(g.round, 2)]];
      if (g.phase === "playing" && g.t0 !== null) {
        const el = performance.now() - g.t0;
        const shape = SHAPE_ORDER[g.round];
        const limit = SHAPE_LIMIT_MS[shape];
        left = Math.max(0, limit - el);
        g.leftMs = left;
        g.lim = limit;
        const cur = judgeRound(shape, g.trace, { elapsedMs: el });
        g.live = cur;
        if (cur.cracks > g.prevCracks) {
          g.prevCracks = cur.cracks;
          buzz([90, 40, 90]); // 균열이 생겼다
        }
        if (cur.complete || cur.broken || el >= limit) {
          const fin = judgeRound(shape, g.trace, { elapsedMs: cur.complete || cur.broken ? el : limit });
          g.live = fin;
          if (!validateHumanTrace(shape, g.trace).ok) g.valid = false;
          g.rounds = [...g.rounds, fin];
          logRound(shape, limit, cur.complete || cur.broken ? el : limit, fin);
          g.phase = fin.broken || !fin.complete || g.rounds.length >= SHAPE_ORDER.length ? "done" : "between";
          left = fin.complete ? fin.timeLeftMs : 0;
          g.leftMs = left;
          buzz(0); // 한 판이 끝나면 진동은 멈춘다(사장님 2026-11-01)
        }
        sync(left);
      }
      if (canvasRef.current) drawAll(canvasRef.current, g);
      raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, []);

  const toPt = (e: React.PointerEvent<HTMLCanvasElement>) => {
    const rc = e.currentTarget.getBoundingClientRect();
    return { x: (e.clientX - rc.left) / rc.width, y: (e.clientY - rc.top) / rc.height };
  };

  const onDown = (e: React.PointerEvent<HTMLCanvasElement>) => {
    const g = gRef.current;
    if (g.phase !== "ready" && g.phase !== "playing") return;
    e.currentTarget.setPointerCapture(e.pointerId);
    if (g.t0 === null) {
      g.t0 = performance.now();
      g.phase = "playing";
    }
    g.trace.push({ ...toPt(e), t: performance.now() - g.t0 });
  };

  const onMove = (e: React.PointerEvent<HTMLCanvasElement>) => {
    const g = gRef.current;
    if (g.phase !== "playing" || g.t0 === null || e.buttons === 0) return;
    const p = toPt(e);
    g.trace.push({ ...p, t: performance.now() - g.t0 });
    // 홈 밖으로 벗어나 있으면 손끝이 떨린다
    const now = performance.now();
    if (now - g.lastBuzz > 70 && distToPolyline(p, outlineOf(SHAPE_ORDER[g.round])) > DEFAULT_TOLERANCE) {
      g.lastBuzz = now;
      buzz(35);
    }
  };

  const onUp = () => {
    const g = gRef.current;
    if (g.phase !== "playing" || g.t0 === null) return;
    const el = performance.now() - g.t0;
    const shape = SHAPE_ORDER[g.round];
    const fin = judgeRound(shape, g.trace, { elapsedMs: el, ended: true });
    g.live = fin;
    if (!validateHumanTrace(shape, g.trace).ok) g.valid = false;
    g.rounds = [...g.rounds, fin];
    logRound(shape, SHAPE_LIMIT_MS[shape], el, fin);
    g.phase = fin.broken || !fin.complete || g.rounds.length >= SHAPE_ORDER.length ? "done" : "between";
    g.leftMs = fin.complete ? fin.timeLeftMs : 0;
    buzz(0); // 손을 떼어 끝나도 진동은 멈춘다
    sync(fin.complete ? fin.timeLeftMs : 0);
  };

  const nextRound = () => {
    const g = gRef.current;
    gRef.current = { ...fresh(), round: g.round + 1, rounds: g.rounds, valid: g.valid };
    sync(SHAPE_LIMIT_MS[SHAPE_ORDER[Math.min(gRef.current.round, 2)]]);
  };

  const reset = () => {
    gRef.current = fresh();
    sync(SHAPE_LIMIT_MS[SHAPE_ORDER[0]]);
  };

  const { phase, round, leftMs, live, rounds, valid } = ui;
  const shape = SHAPE_ORDER[Math.min(round, 2)];
  const cracks = live?.cracks ?? 0;
  const last = rounds[rounds.length - 1];
  const summary: SessionSummary | null = phase === "done" ? summarizeSession(rounds, valid) : null;

  // 캐릭터 연출(사장님 확정 3종): 주인공(청록 트레이닝복)은 상황별 표정, 조교는 시작·진행·성공 때, 사장은 마지막 3초에 엿보고 실패하면 나타난다.
  const bomb = phase === "done" && !!last && !last.complete && !last.broken;
  const failed = phase === "done" && !!summary && summary.failed;
  const success = phase === "between" || (phase === "done" && !failed && !bomb);
  const hot = phase === "playing" && leftMs <= 3000;
  const exit = bomb || failed;
  const [dragDone, setDragDone] = useState(false);
  useEffect(() => {
    if (!exit) {
      setDragDone(false);
      return;
    }
    const t = setTimeout(() => setDragDone(true), 1800);
    return () => clearTimeout(t);
  }, [exit]);
  const worker =
    bomb ? "worker_tg_shocked" : failed ? "worker_tg_crying" : success ? (phase === "done" ? "worker_tg_laughing" : "worker_tg_smug") : hot ? "worker_tg_shocked" : "worker_tg_sweating";
  const assistant = phase === "ready" ? "assistant_whistle" : phase === "playing" ? "assistant_clipboard" : success ? "assistant_flag" : "assistant_shrug";
  const boss = bomb ? "frontman_point" : failed ? "frontman_headshake" : hot ? "frontman_peek" : null;

  return (
    <main
      className="relative flex min-h-dvh flex-col items-center bg-black text-white"
      style={{ backgroundImage: "linear-gradient(rgba(0,0,0,0.55), rgba(0,0,0,0.75)), url(/game/bg_dalgona_playground.webp)", backgroundSize: "cover", backgroundPosition: "center" }}
    >
      <div className="w-full max-w-[400px] px-2 pb-6">
        <p className="my-2 rounded bg-yellow-400 px-2 py-1 text-center text-xs font-bold text-black">
          개발용 시제품입니다 (달고나 뽑기 틀 시험, 서버 연결 없음)
        </p>
        <div className="flex items-center justify-between py-2 text-sm">
          <span className="font-bold">
            라운드 {round + 1}/3 · {SHAPE_NAME[shape]}
          </span>
          <span className="tabular-nums">{(leftMs / 1000).toFixed(1)}초</span>
          <span aria-label="균열">
            {Array.from({ length: MAX_CRACKS }, (_, i) => (
              <span key={i} className={i < cracks ? "text-red-500" : "text-gray-600"}>
                {i < cracks ? "✕" : "○"}{" "}
              </span>
            ))}
          </span>
        </div>
        <div className="relative overflow-hidden rounded">
          <style>{`@keyframes dgSway{0%,100%{transform:rotate(-5deg) translateY(0)}50%{transform:rotate(5deg) translateY(-6px)}}@keyframes dgShake{0%,100%{transform:translateX(0)}25%{transform:translateX(-3px)}75%{transform:translateX(3px)}}@keyframes dgDrag{from{transform:translateX(105%)}to{transform:translateX(-125%)}}`}</style>
          <canvas
            ref={canvasRef}
            width={W}
            height={H}
            className="w-full touch-none rounded bg-neutral-900"
            onPointerDown={onDown}
            onPointerMove={onMove}
            onPointerUp={onUp}
            onPointerCancel={onUp}
          />
          <div className="pointer-events-none absolute inset-0" aria-hidden>
            {!exit && (
              // eslint-disable-next-line @next/next/no-img-element
              <img
                src={`/game/${worker}.png`}
                alt=""
                className="absolute bottom-1 left-1 h-24 w-auto object-contain drop-shadow-lg"
                style={{ animation: hot ? "dgShake 0.12s infinite" : phase === "playing" || phase === "ready" ? "dgSway 1.6s ease-in-out infinite" : undefined, transformOrigin: "50% 100%" }}
              />
            )}
            {!exit && (
              // eslint-disable-next-line @next/next/no-img-element
              <img src={`/game/${hot ? "frontman_peek" : assistant}.png`} alt="" className="absolute bottom-1 right-1 h-24 w-auto object-contain drop-shadow-lg" />
            )}
            {exit && (
              // eslint-disable-next-line @next/next/no-img-element
              <img src="/game/drag_combo.png" alt="" className="absolute bottom-2 left-0 h-36 w-auto drop-shadow-xl" style={{ animation: "dgDrag 1.6s ease-in forwards" }} />
            )}
          </div>
        </div>
        <p className="py-2 text-center text-sm text-gray-300">
          {phase === "ready" && "초록 점에서 시작해 갈색 홈을 따라 그리고, 끝선을 초록 점에 닿게 이어야 성공"}
          {phase === "playing" && `정확도 ${live ? live.accuracy.toFixed(0) : 0}% (진행 중) · 끝선을 초록 점에 이으세요`}
          {phase === "between" && last && (last.complete ? `성공! 정확도 ${last.accuracy}%${last.timeLeftMs < 800 ? " · 아슬아슬!" : ""}` : `시간 초과, 균열 ${last.cracks}칸`)}
        </p>
        {phase === "between" && (
          <button className="w-full rounded bg-green-700 py-3 font-bold" onClick={nextRound}>
            다음 라운드
          </button>
        )}
        {summary && (!exit || dragDone) && (
          <div className="rounded bg-neutral-800 p-4 text-center">
            <p className="text-xl font-bold">{last && !last.complete && !last.broken ? "💣 펑! 시간 초과" : summary.failed ? (last && last.broken && last.cracks < 3 ? "끝선이 첫선에 닿지 않아 실패" : "달고나가 깨졌어요") : summary.totalCracks === 0 ? "NO CRACKS. NO NOTES." : "클리어!"}</p>
            {last && !last.complete && <p className="mt-1 text-sm text-orange-300">테두리 {Math.round(last.coverage * 100)}%까지 그렸어요{last.coverage >= 0.8 ? " · 아슬아슬하게 놓쳤어요!" : ""}</p>}
            <p className="mt-2">정확도 {summary.totalAccuracy}%</p>
            <p>남은 시간 {(summary.timeLeftMs / 1000).toFixed(1)}초</p>
            <p>
              균열 {summary.totalCracks}칸 · 라운드별 {rounds.map((r) => r.accuracy.toFixed(0) + "%").join(" / ")}
            </p>
            <p className="text-sm text-gray-400">
              랭킹 {summary.rankEligible ? "대상" : "제외"}
              {!valid && " (너무 빠른 궤적이라 무효)"}
            </p>
            <button className="mt-3 w-full rounded bg-green-700 py-3 font-bold" onClick={reset}>
              다시 하기
            </button>
          </div>
        )}
      </div>
    </main>
  );
}
