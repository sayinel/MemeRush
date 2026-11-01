import test from "node:test";
import assert from "node:assert/strict";
import {
  shapeOutline, polylineLength, judgeRound, validateHumanTrace, minLapMs, summarizeSession,
  rankSortKey, compareRank, ROUND_MS, SHAPE_ORDER, SHAPE_LIMIT_MS,
} from "../src/game/dalgona_logic.ts";

// outline을 totalMs 동안 따라가는 궤적. offset: 안쪽(중심 방향) 이탈량, from~to 구간만(0~1 비율)
function lap(shape, totalMs, { offset = 0, from = 0, to = 1, laps = 1, hz = 60 } = {}) {
  const o = shapeOutline(shape);
  const total = polylineLength(o);
  const out = [];
  const n = Math.round((totalMs / 1000) * hz);
  for (let i = 0; i <= n; i++) {
    const f = (i / n) * laps;
    let target = (f % 1 || (f > 0 ? 1 : 0)) * total;
    let acc = 0, k = 1;
    while (k < o.length - 1 && acc + Math.hypot(o[k].x - o[k - 1].x, o[k].y - o[k - 1].y) < target) {
      acc += Math.hypot(o[k].x - o[k - 1].x, o[k].y - o[k - 1].y); k++;
    }
    const a = o[k - 1], b = o[k];
    const l = Math.hypot(b.x - a.x, b.y - a.y) || 1;
    const u = Math.min(1, Math.max(0, (target - acc) / l));
    let x = a.x + (b.x - a.x) * u, y = a.y + (b.y - a.y) * u;
    const r = i / n;
    if (offset && r >= from && r <= to) { x += (0.5 - x) * offset; y += (0.5 - y) * offset; }
    out.push({ x, y, t: (i / n) * totalMs });
  }
  return out;
}

test("라운드 모양(하트·별·우산)은 순서대로 쉬운 것에서 어려운 것, 복잡할수록 시간을 더 준다", () => {
  assert.deepEqual(SHAPE_ORDER, ["heart", "star", "umbrella"]);
  const lim = SHAPE_ORDER.map((s) => SHAPE_LIMIT_MS[s]);
  assert.ok(lim[0] < lim[1] && lim[1] < lim[2], String(lim)); // 복잡한 모양일수록 시간은 더 주되, 필요한 속도는 비슷하게 빠듯하다
});

test("모양 3개는 닫힌 0~1 폴리라인", () => {
  for (const s of SHAPE_ORDER) {
    const o = shapeOutline(s);
    assert.ok(o.length > 30);
    assert.deepEqual(o[0], o[o.length - 1]);
    for (const p of o) assert.ok(p.x >= 0 && p.x <= 1 && p.y >= 0 && p.y <= 1);
  }
});

test("완벽한 궤적: 정확도 높고 균열 0, 완주, 남은 시간 있음", () => {
  for (const s of SHAPE_ORDER) {
    const r = judgeRound(s, lap(s, SHAPE_LIMIT_MS[s] * 0.6));
    assert.equal(r.cracks, 0, s);
    assert.ok(r.accuracy >= 95, s + " " + r.accuracy);
    assert.equal(r.complete, true);
    assert.equal(r.timedOut, false);
    const lim = SHAPE_LIMIT_MS[s];
    const lapMs = lim * 0.6;
    assert.ok(r.timeLeftMs > lim - lapMs - 500 && r.timeLeftMs <= lim - lapMs * 0.85, s + " " + r.timeLeftMs);
  }
});

test("크게 벗어난 구간 하나는 균열 1회", () => {
  const r = judgeRound("circle", lap("circle", 6000, { offset: 0.5, from: 0.2, to: 0.3 }));
  assert.equal(r.cracks, 1);
  assert.equal(r.broken, false);
});

test("벗어났다 돌아오기를 3번 하면 깨짐", () => {
  // 세 구간 모두 이탈
  const base = lap("circle", 8000);
  const bad = base.map((p, i) => {
    const r = i / (base.length - 1);
    const inGap = (r >= 0.1 && r <= 0.15) || (r >= 0.3 && r <= 0.35) || (r >= 0.6 && r <= 0.65);
    return inGap ? { ...p, x: p.x + (0.5 - p.x) * 0.5, y: p.y + (0.5 - p.y) * 0.5 } : p;
  });
  const r = judgeRound("circle", bad);
  assert.equal(r.cracks, 3);
  assert.equal(r.broken, true);
  assert.equal(r.complete, false);
  assert.equal(r.crackAtMs.length, 3);
});

test("10초 안에 못 돌면 시간 초과, 균열 1칸 추가, 남은 시간 0", () => {
  const r = judgeRound("triangle", lap("triangle", 16000));
  assert.equal(r.timedOut, true);
  assert.equal(r.complete, false);
  assert.equal(r.cracks, 1);
  assert.equal(r.timeLeftMs, 0);
  assert.ok(r.coverage < 0.8);
});

test("한계 시간 이후 점은 무시된다(10초 안에 이미 완주하면 성공)", () => {
  const tr = [...lap("circle", 8000), { x: 0.9, y: 0.9, t: 12000 }];
  const r = judgeRound("circle", tr, { limitMs: ROUND_MS });
  assert.equal(r.complete, true);
});

test("빈 궤적과 이상한 입력도 안전", () => {
  const r = judgeRound("star", []);
  assert.equal(r.accuracy, 0);
  assert.equal(r.complete, false);
  const r2 = judgeRound("star", [{ x: NaN, y: 0, t: 0 }, null]);
  assert.equal(r2.cracks, 0);
  assert.deepEqual(validateHumanTrace("star", []), { ok: true, reason: null });
  assert.equal(validateHumanTrace("star", [{ x: 0, y: 0, t: 5 }, { x: 0.1, y: 0, t: 1 }]).ok, false);
});

test("너무 빠른 궤적은 사람이 아니라 무효", () => {
  assert.ok(minLapMs("circle") > 1000);
  const fast = lap("circle", 400);
  const v = validateHumanTrace("circle", fast);
  assert.equal(v.ok, false);
  assert.equal(validateHumanTrace("circle", lap("circle", 5000)).ok, true);
});

test("3라운드 합산: 평균 정확도, 남은 시간 합, 실패 여부", () => {
  const good = SHAPE_ORDER.map((s) => judgeRound(s, lap(s, SHAPE_LIMIT_MS[s] * 0.6)));
  const sum = summarizeSession(good);
  assert.equal(sum.failed, false);
  assert.equal(sum.allComplete, true);
  assert.ok(sum.totalAccuracy >= 95);
  assert.equal(sum.timeLeftMs, good.reduce((a, r) => a + r.timeLeftMs, 0));
  assert.equal(sum.rankEligible, true);

  const broken = [good[0], { ...good[1], broken: true, cracks: 3, complete: false, timeLeftMs: 0, accuracy: 30 }, good[2]];
  const s2 = summarizeSession(broken);
  assert.equal(s2.failed, true);
  assert.equal(s2.rankEligible, false);
  assert.equal(rankSortKey(s2), null);
});

test("정렬 키: 정확도 높은 순, 동점이면 남은 시간 많은 순, 미완주는 뒤", () => {
  const mk = (acc, left, extra = {}) => ({
    rounds: 3, totalAccuracy: acc, timeLeftMs: left, totalCracks: 0, failed: false,
    allComplete: true, valid: true, rankEligible: true, ...extra,
  });
  const list = [mk(90, 5000), mk(97, 1000), mk(97, 8000), mk(99, 100, { failed: true, rankEligible: false }), mk(80, 20000)];
  list.sort(compareRank);
  assert.deepEqual(list.map((s) => [s.totalAccuracy, s.timeLeftMs]), [[97, 8000], [97, 1000], [90, 5000], [80, 20000], [99, 100]]);
});

test("무효 궤적(valid=false)은 랭킹 제외", () => {
  const good = SHAPE_ORDER.map((s) => judgeRound(s, lap(s, SHAPE_LIMIT_MS[s] * 0.6)));
  assert.equal(summarizeSession(good, false).rankEligible, false);
});

test("제출 라운드가 부족하면 미완주로 랭킹 제외, 평균은 3라운드 기준", () => {
  const one = [judgeRound("circle", lap("circle", 6000))];
  const s = summarizeSession(one);
  assert.equal(s.allComplete, false);
  assert.ok(s.totalAccuracy < 40);
});

test("끝선이 첫선에 닿지 않으면 테두리를 거의 다 그려도 성공이 아니다", () => {
  for (const s of SHAPE_ORDER) {
    const full = lap(s, SHAPE_LIMIT_MS[s] * 0.6);
    const cut = full.slice(0, Math.floor(full.length * 0.93)); // 93%까지만 그리고 멈춤(시작 점까지 못 돌아옴)
    const r = judgeRound(s, cut, { elapsedMs: 9000 });
    assert.equal(r.complete, false, s);
    assert.equal(judgeRound(s, full).complete, true, s);
  }
});

test("끝선이 첫선에 닿지 않은 채 펜을 떼면 무조건 실패(깨짐)", () => {
  for (const s of SHAPE_ORDER) {
    const full = lap(s, SHAPE_LIMIT_MS[s] * 0.6);
    const cut = full.slice(0, Math.floor(full.length * 0.93));
    const open = judgeRound(s, cut, { elapsedMs: 5000, ended: true });
    assert.equal(open.complete, false, s);
    assert.equal(open.broken, true, s);
    const closed = judgeRound(s, full, { elapsedMs: 6000, ended: true });
    assert.equal(closed.complete, true, s);
    assert.equal(closed.broken, false, s);
  }
});
