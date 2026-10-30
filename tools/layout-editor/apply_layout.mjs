// usage: node apply_layout.mjs <screen>  e.g. round1, intro, result_late, ranking, email_input ...   -> reads out/layout_round1.json, rewrites web/src/game/layout_round1.ts
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { rewriteLayoutTs } from "./lib_layoutTs.mjs";

const here = path.dirname(fileURLToPath(import.meta.url));
const ALIAS = { countdown: "round1" }; // same screen, same numbers
const screen = ALIAS[process.argv[2]] ?? process.argv[2];
if (!screen || !/^[a-z0-9_]+$/.test(screen)) {
  console.error("usage: node apply_layout.mjs <screen>   (e.g. round1)");
  process.exit(2);
}
const jsonPath = path.join(here, "out", `layout_${screen}.json`);
const tsPath = path.resolve(here, "..", "..", "web", "src", "game", `layout_${screen}.ts`);
try {
  const values = JSON.parse(fs.readFileSync(jsonPath, "utf8"));
  const before = fs.readFileSync(tsPath, "utf8");
  const after = rewriteLayoutTs(before, values);
  if (after === before) console.log(`no change: ${tsPath}`);
  else {
    fs.writeFileSync(tsPath, after);
    console.log(`updated: ${tsPath}`);
  }
} catch (e) {
  console.error("ERROR: " + e.message);
  process.exit(1);
}
