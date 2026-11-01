"use client";

// 개발용 시제품: 밈러시 2편 달고나 뽑기 (outline_trace 틀). 서버·API 없이 로컬 판정만 쓴다.
// 로직은 src/game/dalgona_logic.ts (순수 함수, 시험 tests/dalgona_logic.test.mjs).

import { useEffect, useRef, useState } from "react";
import {
  MAX_CRACKS,
  SHAPE_LIMIT_MS,
  SHAPE_ORDER,
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
}
const fresh = (): G => ({ phase: "ready", round: 0, trace: [], t0: null, live: null, rounds: [], valid: true });

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
  ctx.fillStyle = "#d9a441";
  ctx.beginPath();
  ctx.arc(W / 2, H / 2, 192, 0, Math.PI * 2);
  ctx.fill();
  ctx.strokeStyle = "#fff";
  ctx.lineWidth = 6;
  ctx.stroke();
  // 모양 홈
  const o = shapeOutline(SHAPE_ORDER[Math.min(g.round, 2)]);
  ctx.strokeStyle = "#7a4e12";
  ctx.lineWidth = 7;
  ctx.lineJoin = "round";
  ctx.beginPath();
  o.forEach((p, i) => (i ? ctx.lineTo(p.x * W, p.y * H) : ctx.moveTo(p.x * W, p.y * H)));
  ctx.stroke();
  // 시작점
  ctx.fillStyle = "#2ecc71";
  ctx.beginPath();
  ctx.arc(o[0].x * W, o[0].y * H, 8, 0, Math.PI * 2);
  ctx.fill();
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
        const cur = judgeRound(shape, g.trace, { elapsedMs: el });
        g.live = cur;
        if (cur.complete || cur.broken || el >= limit) {
          const fin = judgeRound(shape, g.trace, { elapsedMs: cur.complete || cur.broken ? el : limit });
          g.live = fin;
          if (!validateHumanTrace(shape, g.trace).ok) g.valid = false;
          g.rounds = [...g.rounds, fin];
          g.phase = fin.broken || !fin.complete || g.rounds.length >= SHAPE_ORDER.length ? "done" : "between";
          left = fin.complete ? fin.timeLeftMs : 0;
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
    g.trace.push({ ...toPt(e), t: performance.now() - g.t0 });
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
    g.phase = fin.broken || !fin.complete || g.rounds.length >= SHAPE_ORDER.length ? "done" : "between";
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

  return (
    <main className="flex min-h-dvh flex-col items-center bg-black text-white">
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
        <p className="py-2 text-center text-sm text-gray-300">
          {phase === "ready" && "초록 점에서 시작해 갈색 홈을 따라 그리고, 끝선을 초록 점에 닿게 이어야 성공"}
          {phase === "playing" && `정확도 ${live ? live.accuracy.toFixed(0) : 0}% (진행 중) · 끝선을 초록 점에 이으세요`}
          {phase === "between" && last && (last.complete ? `성공! 정확도 ${last.accuracy}%` : `시간 초과, 균열 ${last.cracks}칸`)}
        </p>
        {phase === "between" && (
          <button className="w-full rounded bg-green-700 py-3 font-bold" onClick={nextRound}>
            다음 라운드
          </button>
        )}
        {summary && (
          <div className="rounded bg-neutral-800 p-4 text-center">
            <p className="text-xl font-bold">{last && !last.complete && !last.broken ? "💣 펑! 시간 초과" : summary.failed ? (last && last.broken && last.cracks < 3 ? "끝선이 첫선에 닿지 않아 실패" : "달고나가 깨졌어요") : summary.totalCracks === 0 ? "NO CRACKS. NO NOTES." : "클리어!"}</p>
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
