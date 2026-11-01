// 조합판 저장 파일(부분 저장 포함)을 좌표 파일에 합친다. apply_layout.mjs는 이름이 전부 같아야 하지만 이것은 저장된 것만 덮는다.
// 사용: node apply_merge.mjs <screen> [<screen> ...]   그다음 node normalize_layout.mjs <screen> ...
import fs from "node:fs";
import { parseLayoutTs, rewriteLayoutTs } from "./lib_layoutTs.mjs";
for (const s of process.argv.slice(2)) {
  const jp = `./out/layout_${s}.json`;
  const tp = `../../web/src/game/layout_${s}.ts`;
  if (!fs.existsSync(jp) || !fs.existsSync(tp)) { console.log(s, "skip"); continue; }
  const saved = JSON.parse(fs.readFileSync(jp, "utf8"));
  const before = fs.readFileSync(tp, "utf8");
  const cur = parseLayoutTs(before);
  const merged = {};
  for (const k of Object.keys(cur)) merged[k] = { ...cur[k], ...(saved[k] ?? {}) };
  const after = rewriteLayoutTs(before, merged);
  if (after !== before) fs.writeFileSync(tp, after);
  console.log(s, after === before ? "변경 없음" : "반영", `저장 ${Object.keys(saved).length}/${Object.keys(cur).length}`);
}
