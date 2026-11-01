// 피그마의 정렬 가이드선을 대신한다: 사람이 맞춘 위치에서 '거의 같은' 가장자리·중심을 찾아 한 값으로 모은다.
// 사용: node auto_align.mjs <screen> [<screen> ...]  (apply_merge → normalize_layout 다음에 실행, 두 번 돌려도 같은 결과)
// 가이드 종류(요소 쌍 사이): 가운데 x, 왼쪽 가장자리, 오른쪽 가장자리, 가운데 y, 위 가장자리, 아래 가장자리, 같은 너비·높이.
// 허용 오차(TOL px) 안에 모인 값들은 중앙값으로 맞춘다. 허용 밖은 사장님 의도로 보고 둔다. 바뀐 것은 모두 숫자로 보고한다.
import fs from "node:fs";
import { parseLayoutTs, rewriteLayoutTs } from "./lib_layoutTs.mjs";
const TOL = 6;          // 가이드에 붙는 거리(px)
const SIZE_TOL = 8;     // 같은 너비·높이로 보는 차이(px)
const IGNORE = new Set(["row1", "row2", "row3", "row4", "row5", "panel", "bg", "hider", "clock_panel", "ribbon", "star_left", "star_right", "duck", "paper_pile", "effect_poof", "confetti"]);
const STD = JSON.parse(fs.readFileSync(new URL("./standard_positions.json", import.meta.url), "utf8"));
const OWN_X = new Set(STD.centerElements);                 // 표준 위치(normalize)가 x를 맡은 요소는 건드리지 않는다
const OWN_Y = new Set(STD.slots.map((s) => s.name));       // y를 맡은 요소도 마찬가지
const r1 = (v) => Math.round(v * 10) / 10;
const med = (a) => { const s = [...a].sort((x, y) => x - y); const m = s.length >> 1; return s.length % 2 ? s[m] : (s[m - 1] + s[m]) / 2; };

function clusters(items, key) {            // items: [{name, v}] 값이 TOL 안에 이어지는 묶음
  const s = [...items].sort((a, b) => a.v - b.v); const out = []; let cur = [];
  for (const it of s) {
    if (cur.length && it.v - cur[0].v > TOL) { out.push(cur); cur = []; }
    cur.push(it);
  }
  if (cur.length) out.push(cur);
  return out.filter((c) => c.length >= 2);
}

for (const s of process.argv.slice(2)) {
  const tp = `../../web/src/game/layout_${s}.ts`;
  if (!fs.existsSync(tp)) { console.log(s, "skip"); continue; }
  const before = fs.readFileSync(tp, "utf8");
  const cur = parseLayoutTs(before);
  const next = JSON.parse(JSON.stringify(cur));
  const names = Object.keys(next).filter((n) => !IGNORE.has(n) && next[n].w < 700);   // 화면 전체 크기 요소는 제외
  const log = [];
  // 가이드별로 한 번씩, 값을 직접 옮기는 방식(중심·왼쪽·오른쪽·위·아래)
  const guides = [
    ["cx", (e) => e.x, (e, d) => { e.x += d; }],
    ["left", (e) => e.x - e.w / 2, (e, d) => { e.x += d; }],
    ["right", (e) => e.x + e.w / 2, (e, d) => { e.x += d; }],
    ["cy", (e) => e.y, (e, d) => { e.y += d; }],
  ];
  for (let pass = 0; pass < 6; pass++) {
  let changed = false;
  const touched = new Set();   // 같은 요소가 한 축에서 두 번 움직이지 않게
  for (const axis of ["x", "y"]) {
    const gs = axis === "x" ? guides.slice(0, 3) : guides.slice(3);
    for (const [gname, get, set] of gs) {
      const own = axis === "x" ? OWN_X : OWN_Y;
      const items = names.filter((n) => !touched.has(axis + n) && !own.has(n)).map((n) => ({ name: n, v: get(next[n]) }));
      for (const c of clusters(items)) {
        const target = r1(med(c.map((i) => i.v)));
        const moves = c.filter((i) => Math.abs(i.v - target) > 0.3);
        if (!moves.length) continue;
        for (const m of moves) { set(next[m.name], target - m.v); touched.add(axis + m.name); changed = true; log.push(`${m.name}.${gname} ${r1(m.v)}→${target}`); }
        for (const i of c) touched.add(axis + i.name);
      }
    }
  }
  for (const n of Object.keys(next)) for (const k of ["x", "y"]) next[n][k] = r1(next[n][k]);
  if (!changed) break;
  }
  const after = rewriteLayoutTs(before, next);
  if (after !== before) fs.writeFileSync(tp, after);
  console.log(`${s}: ${log.length}건 정렬${log.length ? " — " + log.join(", ") : ""}`);
}
