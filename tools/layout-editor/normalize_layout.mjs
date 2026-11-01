// 사람이 맞춘 위치의 몇 px 오차를 표준 위치(standard_positions.json)로 보정한다.
// 사용: node normalize_layout.mjs <screen> [<screen> ...]   (이미 merge로 좌표 파일에 반영된 뒤 실행)
// 규칙: ① centerElements는 x가 360±8이면 360으로 ② slots에 있는 요소는 표준값과의 차가 허용 범위 안이면 표준값으로.
// 허용 범위를 벗어난 것은 사장님의 의도로 보고 그대로 둔다. 바뀐 것은 모두 화면에 표로 보고한다.
import fs from "node:fs";
import { parseLayoutTs, rewriteLayoutTs } from "./lib_layoutTs.mjs";
const std = JSON.parse(fs.readFileSync("./standard_positions.json", "utf8"));
const centers = new Set(std.centerElements);
const r1 = (v) => Math.round(v * 10) / 10;
for (const s of process.argv.slice(2)) {
  const tp = `../../web/src/game/layout_${s}.ts`;
  if (!fs.existsSync(tp)) { console.log(s, "skip"); continue; }
  const before = fs.readFileSync(tp, "utf8");
  const cur = parseLayoutTs(before);
  const next = JSON.parse(JSON.stringify(cur));
  const changes = [];
  for (const [name, e] of Object.entries(next)) {
    if (centers.has(name) && Math.abs(e.x - std.global.centerX) <= std.global.centerTol && e.x !== std.global.centerX) {
      changes.push(`${name}.x ${r1(e.x)}→${std.global.centerX}`); e.x = std.global.centerX;
    }
    for (const sl of std.slots) {
      if (sl.name !== name || !sl.screens.includes(s)) continue;
      if (sl.y != null && Math.abs(e.y - sl.y) <= sl.yTol && e.y !== sl.y) { changes.push(`${name}.y ${r1(e.y)}→${sl.y}`); e.y = sl.y; }
      if (sl.w != null && Math.abs(e.w - sl.w) <= sl.wTol && e.w !== sl.w) { changes.push(`${name}.w ${r1(e.w)}→${sl.w}`); e.w = sl.w; }
    }
  }
  const after = rewriteLayoutTs(before, next);
  if (after !== before) fs.writeFileSync(tp, after);
  console.log(`${s}: ${changes.length}건 보정${changes.length ? " — " + changes.join(", ") : ""}`);
}
