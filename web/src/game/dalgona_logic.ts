// 달고나 뽑기(outline_trace 틀 시제품)의 순수 판정 로직. 의존성 없음, 좌표는 정규화 0~1.
// 규칙 출처: docs/GAME_02_DALGONA_SCRIPT.md 2장.

// 홈 중심선 경로(0~1 정규화, 닫힌 선). 사장님이 컨펌한 달고나 원판 그림(2026-11-01)에서 직접 뽑았다.
// 만든 법: 원판에서 짙은 갈색 홈을 분리 → 안쪽을 채워 윤곽 → 선 굵기 절반만큼 줄여 중심선 → 단순화.
// 원판 그림은 public/game/dalgona_disc_*_confirmed.png 이고, 원판이 캔버스 지름 0.96(반지름 0.48, 중심 0.5,0.5)에 오도록 맞췄다.
const GROOVE_PATHS: Record<"heart" | "star" | "umbrella", ReadonlyArray<readonly [number, number]>> = {"heart": [[0.3193, 0.2596], [0.3916, 0.2627], [0.445, 0.2847], [0.5016, 0.335], [0.5361, 0.2973], [0.5864, 0.269], [0.6241, 0.2596], [0.6964, 0.2627], [0.7655, 0.2973], [0.786, 0.3177], [0.8142, 0.368], [0.8268, 0.4246], [0.8237, 0.478], [0.808, 0.5346], [0.7671, 0.61], [0.7043, 0.6885], [0.6555, 0.7373], [0.5424, 0.8284], [0.5016, 0.8504], [0.5016, 0.8504], [0.4796, 0.8441], [0.4104, 0.7938], [0.2957, 0.6885], [0.2266, 0.6006], [0.1858, 0.5189], [0.1732, 0.4591], [0.1732, 0.4214], [0.1826, 0.3743], [0.2172, 0.3146], [0.247, 0.2879], [0.2847, 0.269], [0.3193, 0.2596]], "star": [[0.1769, 0.4294], [0.18, 0.4106], [0.2035, 0.3996], [0.3855, 0.3776], [0.4027, 0.3604], [0.4812, 0.191], [0.4953, 0.1831], [0.5078, 0.1831], [0.522, 0.1941], [0.5973, 0.3604], [0.6145, 0.3776], [0.809, 0.4027], [0.8231, 0.42], [0.82, 0.4388], [0.6757, 0.5737], [0.6757, 0.5988], [0.7071, 0.7651], [0.7039, 0.7839], [0.6929, 0.7918], [0.6929, 0.7918], [0.6678, 0.7886], [0.5016, 0.6976], [0.3259, 0.7918], [0.3039, 0.7918], [0.2961, 0.7839], [0.2929, 0.762], [0.3275, 0.58], [0.2976, 0.5471], [0.1925, 0.4545], [0.1769, 0.4294]], "umbrella": [[0.1683, 0.508], [0.1683, 0.4825], [0.1843, 0.4091], [0.2098, 0.3549], [0.2353, 0.3166], [0.2783, 0.2736], [0.3294, 0.2385], [0.3804, 0.2161], [0.441, 0.2002], [0.4665, 0.2002], [0.4809, 0.1858], [0.4809, 0.1699], [0.4952, 0.1587], [0.5048, 0.1587], [0.5191, 0.1667], [0.5223, 0.1858], [0.5335, 0.197], [0.5781, 0.2034], [0.6387, 0.2225], [0.7025, 0.2576], [0.7615, 0.3102], [0.7966, 0.3613], [0.8126, 0.3963], [0.8285, 0.4474], [0.8349, 0.508], [0.8205, 0.5064], [0.7823, 0.4713], [0.7504, 0.4713], [0.7376, 0.4777], [0.7025, 0.5191], [0.6674, 0.4809], [0.6387, 0.4681], [0.6037, 0.4777], [0.5718, 0.5159], [0.5622, 0.5159], [0.5335, 0.4841], [0.5223, 0.4952], [0.5223, 0.7695], [0.4984, 0.8157], [0.4538, 0.8349], [0.4538, 0.8349], [0.4155, 0.8317], [0.3788, 0.811], [0.3597, 0.7727], [0.3597, 0.7408], [0.3772, 0.7264], [0.3963, 0.7296], [0.4075, 0.7695], [0.4346, 0.7902], [0.4538, 0.787], [0.4777, 0.7599], [0.4777, 0.4952], [0.4665, 0.4841], [0.4378, 0.5159], [0.4282, 0.5159], [0.3963, 0.4777], [0.3836, 0.4713], [0.3517, 0.4713], [0.3389, 0.4777], [0.307, 0.5159], [0.2943, 0.5159], [0.2863, 0.4984], [0.2528, 0.4713], [0.2114, 0.4745], [0.1795, 0.5096], [0.1683, 0.508]]};

export type ShapeId = "circle" | "triangle" | "star" | "heart" | "umbrella";
// 사장님 2026-11-01: 하트(매우 쉬움) → 별 → 우산(될랑 말랑). circle·triangle은 시험·예비용으로 남긴다.
export const SHAPE_ORDER: ShapeId[] = ["heart", "star", "umbrella"];
// 라운드(모양)별 제한 시간. 마지막 판은 될랑 말랑하게 짧다. 플레이하며 조정.
export const SHAPE_LIMIT_MS: Record<ShapeId, number> = {
  circle: 10000,
  triangle: 10000,
  heart: 4800,
  star: 5800,
  umbrella: 7000,
};

export interface Pt {
  x: number;
  y: number;
}
export interface TracePt extends Pt {
  t: number; // 라운드 시작 후 ms
}

export const ROUND_MS = 10000;
export const MAX_CRACKS = 3;
export const DEFAULT_TOLERANCE = 0.038; // 정규화 단위(폭의 3.8%, 사장님 2026-11-01 '아직 쉬움'으로 4.5%에서 조임). 플레이하며 조정
export const COMPLETE_COVERAGE = 0.92; // 테두리 이만큼 덮으면 완주
export const CLOSE_RADIUS = 0.07; // 사장님 2026-11-01: 끝선이 첫선(초록 점)에 닿아야 성공. 폭의 7%
export const MAX_HUMAN_SPEED = 1.6; // 폭/초. 이보다 빠른 궤적은 사람이 아님

// ---------- 모양 ----------

function densify(corners: Pt[], step: number): Pt[] {
  const out: Pt[] = [];
  for (let i = 0; i < corners.length - 1; i++) {
    const a = corners[i];
    const b = corners[i + 1];
    const n = Math.max(1, Math.ceil(Math.hypot(b.x - a.x, b.y - a.y) / step));
    for (let k = 0; k < n; k++) out.push({ x: a.x + ((b.x - a.x) * k) / n, y: a.y + ((b.y - a.y) * k) / n });
  }
  out.push({ ...corners[corners.length - 1] });
  return out;
}

/** 닫힌 폴리라인(첫 점 == 마지막 점). 0~1 정규화. */
export function shapeOutline(shape: ShapeId): Pt[] {
  if (shape === "circle") {
    const n = 120;
    const pts: Pt[] = [];
    for (let i = 0; i < n; i++) {
      const a = (i / n) * Math.PI * 2 - Math.PI / 2;
      pts.push({ x: 0.5 + 0.34 * Math.cos(a), y: 0.5 + 0.34 * Math.sin(a) });
    }
    pts.push({ ...pts[0] });
    return pts;
  }
  if (shape === "triangle") {
    const c = [
      { x: 0.5, y: 0.14 },
      { x: 0.86, y: 0.8 },
      { x: 0.14, y: 0.8 },
      { x: 0.5, y: 0.14 },
    ];
    return densify(c, 0.01);
  }
  if (shape === "heart" || shape === "star" || shape === "umbrella") {
    // 컨펌한 원판 그림에서 뽑은 홈 중심선(GROOVE_PATHS). 한 번에 이어 그리는 닫힌 선이다.
    const c: Pt[] = GROOVE_PATHS[shape].map(([x, y]) => ({ x, y }));
    c[c.length - 1] = { ...c[0] };
    return densify(c, 0.01);
  }
  throw new Error("unknown shape: " + String(shape));
}

export function polylineLength(pts: Pt[]): number {
  let s = 0;
  for (let i = 1; i < pts.length; i++) s += Math.hypot(pts[i].x - pts[i - 1].x, pts[i].y - pts[i - 1].y);
  return s;
}

function distToSegment(p: Pt, a: Pt, b: Pt): number {
  const dx = b.x - a.x;
  const dy = b.y - a.y;
  const l2 = dx * dx + dy * dy;
  let u = l2 === 0 ? 0 : ((p.x - a.x) * dx + (p.y - a.y) * dy) / l2;
  u = Math.max(0, Math.min(1, u));
  return Math.hypot(p.x - (a.x + u * dx), p.y - (a.y + u * dy));
}

export function distToPolyline(p: Pt, line: Pt[]): number {
  let best = Infinity;
  for (let i = 1; i < line.length; i++) best = Math.min(best, distToSegment(p, line[i - 1], line[i]));
  return best;
}

/** 테두리를 호 길이 기준으로 균등하게 n개 표본으로 나눈다(마지막 중복점 제외). */
function sampleOutline(line: Pt[], n: number): Pt[] {
  const total = polylineLength(line);
  const out: Pt[] = [];
  let seg = 1;
  let acc = 0;
  for (let i = 0; i < n; i++) {
    const target = (i / n) * total;
    while (seg < line.length - 1 && acc + Math.hypot(line[seg].x - line[seg - 1].x, line[seg].y - line[seg - 1].y) < target) {
      acc += Math.hypot(line[seg].x - line[seg - 1].x, line[seg].y - line[seg - 1].y);
      seg++;
    }
    const a = line[seg - 1];
    const b = line[seg];
    const l = Math.hypot(b.x - a.x, b.y - a.y) || 1;
    const u = Math.max(0, Math.min(1, (target - acc) / l));
    out.push({ x: a.x + (b.x - a.x) * u, y: a.y + (b.y - a.y) * u });
  }
  return out;
}

/** 궤적을 선분 사이 보간으로 촘촘히 한다(빠른 손가락의 성긴 이벤트 보정). */
function densifyTrace(trace: TracePt[], step = 0.01): TracePt[] {
  const out: TracePt[] = [];
  for (let i = 0; i < trace.length; i++) {
    const b = trace[i];
    if (i === 0) {
      out.push(b);
      continue;
    }
    const a = trace[i - 1];
    const n = Math.max(1, Math.ceil(Math.hypot(b.x - a.x, b.y - a.y) / step));
    for (let k = 1; k <= n; k++) {
      const u = k / n;
      out.push({ x: a.x + (b.x - a.x) * u, y: a.y + (b.y - a.y) * u, t: a.t + (b.t - a.t) * u });
    }
  }
  return out;
}

// ---------- 라운드 판정 ----------

export interface JudgeOptions {
  tolerance?: number;
  limitMs?: number;
  /** 펜을 뗐다(손가락을 뗌). 끝선이 첫선에 닿지 않은 채 떼면 무조건 실패(사장님 2026-11-01) */
  ended?: boolean;
  /** UI 시계가 이미 한계에 도달했음을 알릴 때(마지막 점 이후에도 시간이 흘렀다면) */
  elapsedMs?: number;
}

export interface RoundResult {
  shape: ShapeId;
  cracks: number; // 0~3
  crackAtMs: number[]; // 균열이 생긴 시각(시간 초과 균열 포함)
  accuracy: number; // 0~100
  coverage: number; // 0~1
  meanDeviation: number; // 정규화 단위
  complete: boolean;
  timedOut: boolean;
  broken: boolean; // 균열 3번
  completeAtMs: number | null;
  timeLeftMs: number; // 완주했을 때만 > 0
}

const SAMPLES = 120;

export function judgeRound(shape: ShapeId, trace: TracePt[], opts: JudgeOptions = {}): RoundResult {
  const tol = opts.tolerance ?? DEFAULT_TOLERANCE;
  const limit = opts.limitMs ?? SHAPE_LIMIT_MS[shape];
  const outline = shapeOutline(shape);
  const samples = sampleOutline(outline, SAMPLES);

  // 유효 점: 숫자이고 한계 시간 안
  const clean = trace.filter(
    (p) => p && Number.isFinite(p.x) && Number.isFinite(p.y) && Number.isFinite(p.t) && p.t >= 0 && p.t <= limit,
  );
  const dense = densifyTrace(clean);

  const covered = new Array<boolean>(samples.length).fill(false);
  let coveredCount = 0;
  let completeAt: number | null = null;
  let devSum = 0;
  let devN = 0;
  const crackAt: number[] = [];
  let off = false;
  let cracks = 0;

  for (const p of dense) {
    const d = distToPolyline(p, outline);
    devSum += Math.min(d, tol * 2) / (tol * 2);
    devN++;
    if (d > tol) {
      if (!off) {
        off = true;
        cracks++;
        crackAt.push(p.t);
      }
    } else {
      off = false;
      for (let i = 0; i < samples.length; i++) {
        if (!covered[i] && Math.hypot(samples[i].x - p.x, samples[i].y - p.y) <= tol) {
          covered[i] = true;
          coveredCount++;
        }
      }
      // 완주: 테두리를 충분히 덮고, 끝선이 첫선(시작 점)에 닿아 한 바퀴가 이어져야 한다
      if (
        completeAt === null &&
        coveredCount / samples.length >= COMPLETE_COVERAGE &&
        Math.hypot(p.x - outline[0].x, p.y - outline[0].y) <= CLOSE_RADIUS
      )
        completeAt = p.t;
    }
    if (cracks >= MAX_CRACKS) break; // 깨지면 거기서 끝
  }

  const broken = cracks >= MAX_CRACKS;
  const coverage = coveredCount / samples.length;
  const complete = !broken && completeAt !== null;
  const lastT = trace.reduce((m, p) => (p && Number.isFinite(p.t) ? Math.max(m, p.t) : m), 0);
  const timedOut = !complete && !broken && (opts.elapsedMs ?? lastT) >= limit - 1;
  let finalCracks = cracks;
  if (timedOut) {
    crackAt.push(limit);
    finalCracks = cracks + 1;
  }
  finalCracks = Math.min(MAX_CRACKS, finalCracks);
  const openEnd = !!opts.ended && !complete && !broken; // 끝선이 첫선에 닿지 않은 채 끝남
  const finalBroken = finalCracks >= MAX_CRACKS || openEnd;

  const meanDeviation = devN ? devSum / devN : 1; // 0=딱 맞음, 1=2*tol 이상 이탈
  const accuracy = devN
    ? Math.round(Math.max(0, Math.min(100, 100 * (0.7 * coverage + 0.3 * (1 - meanDeviation)))) * 10) / 10
    : 0;

  return {
    shape,
    cracks: finalCracks,
    crackAtMs: crackAt.slice(0, MAX_CRACKS),
    accuracy,
    coverage,
    meanDeviation,
    complete,
    timedOut,
    broken: finalBroken,
    completeAtMs: complete ? completeAt : null,
    timeLeftMs: complete && completeAt !== null ? Math.max(0, Math.round(limit - completeAt)) : 0,
  };
}

// ---------- 사람 가능성 검증 ----------

/** 이 모양을 사람이 한 바퀴 도는 최소 시간(ms). */
export function minLapMs(shape: ShapeId, maxSpeed = MAX_HUMAN_SPEED): number {
  return Math.round((polylineLength(shapeOutline(shape)) / maxSpeed) * 1000);
}

export function validateHumanTrace(
  shape: ShapeId,
  trace: TracePt[],
  maxSpeed = MAX_HUMAN_SPEED,
): { ok: boolean; reason: string | null } {
  if (!Array.isArray(trace) || trace.length === 0) return { ok: true, reason: null }; // 빈 궤적은 점수 0일 뿐 위조가 아님
  for (let i = 0; i < trace.length; i++) {
    const p = trace[i];
    if (!p || !Number.isFinite(p.x) || !Number.isFinite(p.y) || !Number.isFinite(p.t)) return { ok: false, reason: "bad_point" };
    if (i > 0 && p.t < trace[i - 1].t) return { ok: false, reason: "time_not_monotonic" };
  }
  const dur = trace[trace.length - 1].t - trace[0].t;
  const len = polylineLength(trace);
  if (len > 0.05 && dur <= 0) return { ok: false, reason: "zero_duration" };
  if (dur > 0 && (len / dur) * 1000 > maxSpeed) return { ok: false, reason: "too_fast" };
  const r = judgeRound(shape, trace);
  if (r.complete && r.completeAtMs !== null && r.completeAtMs - trace[0].t < minLapMs(shape, maxSpeed) * COMPLETE_COVERAGE) {
    return { ok: false, reason: "lap_too_fast" };
  }
  return { ok: true, reason: null };
}

// ---------- 3라운드 합산 ----------

export interface SessionSummary {
  rounds: number;
  totalAccuracy: number; // 라운드 평균(제출 못 한 라운드는 0으로 셈)
  timeLeftMs: number;
  totalCracks: number;
  failed: boolean; // 한 라운드라도 깨짐
  allComplete: boolean;
  valid: boolean;
  rankEligible: boolean;
}

export function summarizeSession(rounds: RoundResult[], valid = true, expectedRounds = 3): SessionSummary {
  const n = Math.max(expectedRounds, rounds.length);
  const acc = rounds.reduce((s, r) => s + r.accuracy, 0) / n;
  const failed = rounds.some((r) => r.broken);
  const allComplete = rounds.length >= expectedRounds && rounds.every((r) => r.complete);
  return {
    rounds: rounds.length,
    totalAccuracy: Math.round(acc * 10) / 10,
    timeLeftMs: rounds.reduce((s, r) => s + r.timeLeftMs, 0),
    totalCracks: rounds.reduce((s, r) => s + r.cracks, 0),
    failed,
    allComplete,
    valid,
    rankEligible: valid && !failed && allComplete,
  };
}

/** 랭킹용 정렬 키. 큰 값이 위. 완주자만(아니면 null). 정확도 높은 순, 동점이면 남은 시간 많은 순. */
export function rankSortKey(s: SessionSummary): number | null {
  if (!s.rankEligible) return null;
  return Math.round(s.totalAccuracy * 10) * 1_000_000 + Math.min(999_999, Math.round(s.timeLeftMs));
}

/** Array.sort 비교자: 순위가 앞선 쪽이 먼저. 대상 아닌 쪽은 맨 뒤. */
export function compareRank(a: SessionSummary, b: SessionSummary): number {
  const ka = rankSortKey(a);
  const kb = rankSortKey(b);
  if (ka === null && kb === null) return 0;
  if (ka === null) return 1;
  if (kb === null) return -1;
  return kb - ka;
}
