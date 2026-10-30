// For every layout_<screen>.ts: write a json with the first element's y +3, run apply_layout.mjs twice,
// expect exactly 1 changed line, then 'no change' (idempotent); the ts file is restored afterwards.
import fs from "node:fs";
import path from "node:path";
import { execFileSync } from "node:child_process";
import { fileURLToPath } from "node:url";
import { parseLayoutTs } from "./lib_layoutTs.mjs";
const here = path.dirname(fileURLToPath(import.meta.url));
const gdir = path.resolve(here, "..", "..", "web", "src", "game");
let bad = 0;
for (const f of fs.readdirSync(gdir).filter((n) => /^layout_.*\.ts$/.test(n))) {
  const id = f.slice(7, -3);
  const tsPath = path.join(gdir, f);
  const orig = fs.readFileSync(tsPath, "utf8");
  const vals = parseLayoutTs(orig);
  const first = Object.keys(vals)[0];
  vals[first].y += 3;
  const jf = path.join(here, "out", `layout_${id}.json`);
  fs.writeFileSync(jf, JSON.stringify(vals));
  const run = () => execFileSync("node", [path.join(here, "apply_layout.mjs"), id], { encoding: "utf8" }).trim();
  const r1 = run();
  const after = fs.readFileSync(tsPath, "utf8");
  const changed = after.split("\n").filter((l, i) => l !== orig.split("\n")[i]).length;
  const r2 = run();
  const same = fs.readFileSync(tsPath, "utf8") === after;
  fs.writeFileSync(tsPath, orig);
  fs.rmSync(jf);
  const ok = changed === 1 && same && r2.startsWith("no change");
  if (!ok) bad++;
  console.log(id.padEnd(16), "elements", Object.keys(vals).length, "changed lines", changed, "second run:", r2.startsWith("no change") ? "no change" : r2, ok ? "OK" : "FAIL");
}
process.exit(bad ? 1 : 0);
