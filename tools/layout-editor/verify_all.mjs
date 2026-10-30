// Per-screen check of the editor (dev server on 127.0.0.1:5183 must run).
//   node verify_all.mjs <outDir> [screenId ...]
// For each screen: element count, +7px via the number panel, save file, 1:1 frame capture (no overlay) -> <outDir>/frame_<id>.png,
// overlay screenshot (50%) -> <outDir>/editor_<id>_overlay.png. Result summary -> <outDir>/verify_all.json
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { chromium } from "playwright";

const here = path.dirname(fileURLToPath(import.meta.url));
const outDir = process.argv[2] || path.join(here, "out", "verify");
fs.mkdirSync(outDir, { recursive: true });
const browser = await chromium.launch();
const ids = process.argv.slice(3).length
  ? process.argv.slice(3)
  : ["intro", "countdown", "round1", "play", "final_grabbed", "result_late", "result_early", "result_perfect", "ranking", "email_input", "email_invalid", "email_failed", "email_sent"];
const LAYOUT = { countdown: "round1" };
const summary = {};

for (const id of ids) {
  const page = await browser.newPage({ viewport: { width: 1500, height: 1000 } });
  const errors = [];
  page.on("pageerror", (e) => errors.push(String(e)));
  const lid = LAYOUT[id] ?? id;
  const jsonFile = path.join(here, "out", `layout_${lid}.json`);
  fs.rmSync(jsonFile, { force: true });
  await page.goto(`http://127.0.0.1:5183/?screen=${id}`);
  await page.waitForFunction(() => window.__editor && window.__editor.getCurrentPageShapes().length >= 5, null, { timeout: 30000 });
  await page.waitForTimeout(1800);
  const r = { errors };
  const expected = Object.keys((await (await page.request.get(`http://127.0.0.1:5183/api/load?screen=${lid}`)).json()).initial).length;
  r.expected = expected;
  const names = await page.evaluate(() => window.__editor.getCurrentPageShapes().filter((s) => !s.props.name.startsWith("__")).map((s) => s.props.name));
  r.elements = names.length;
  r.countLabel = await page.textContent("[data-testid=count]");
  // number panel: first non-image element, +7 on y
  const first = names[0];
  await page.evaluate((n) => { window.__editor.select("shape:" + n); }, first);
  await page.waitForTimeout(200);
  const y0 = Number(await page.inputValue('[data-field="y"]'));
  await page.fill('[data-field="y"]', String(y0 + 7));
  await page.waitForTimeout(250);
  r.panel_element = first;
  r.panel_y_before = y0;
  r.panel_y_after = Number(await page.inputValue('[data-field="y"]'));
  r.shape_moved_px = await page.evaluate((n) => { const s = window.__editor.getShape("shape:" + n); return s.y; }, first);
  await page.fill('[data-field="y"]', String(y0));
  await page.waitForTimeout(250);
  // 1:1 frame capture without overlay/selection
  await page.evaluate(() => { window.__editor.selectNone(); window.__editor.setCamera({ x: 0, y: 0, z: 1 }, { immediate: true }); });
  await page.setViewportSize({ width: 1100, height: 1420 });
  await page.waitForTimeout(500);
  await page.evaluate(() => window.__editor.setCamera({ x: 0, y: 0, z: 1 }, { immediate: true }));
  await page.waitForTimeout(400);
  const cr = await page.evaluate(() => { const b = document.querySelector("[data-testid=canvas]").getBoundingClientRect(); return { x: b.left, y: b.top }; });
  await page.screenshot({ path: path.join(outDir, `frame_${id}.png`), clip: { x: cr.x, y: cr.y, width: 720, height: 1280 } });
  // save
  await page.setViewportSize({ width: 1500, height: 1000 });
  await page.click("[data-testid=save]");
  await page.waitForFunction(() => document.querySelector("[data-testid=status]").textContent.startsWith("저장됨"), null, { timeout: 10000 });
  r.saved_file = fs.existsSync(jsonFile);
  r.saved_keys = r.saved_file ? Object.keys(JSON.parse(fs.readFileSync(jsonFile, "utf8"))).length : 0;
  // overlay screenshot
  await page.evaluate(() => window.__editor.zoomToBounds({ x: -60, y: -40, w: 840, h: 1360 }, { immediate: true, inset: 0 }));
  await page.check("text=게임 캡처 겹쳐 보기 >> input");
  await page.waitForTimeout(600);
  r.overlay_ref = await page.inputValue("select:nth-of-type(2)").catch(() => null);
  r.overlay_shape = await page.evaluate(() => !!window.__editor.getShape("shape:__ref"));
  await page.screenshot({ path: path.join(outDir, `editor_${id}_overlay.png`) });
  fs.rmSync(jsonFile, { force: true });
  summary[id] = r;
  console.log(id, JSON.stringify({ el: r.elements, exp: r.expected, panel: [r.panel_y_before, r.panel_y_after], saved: r.saved_keys, ref: r.overlay_ref, err: errors.length }));
  await page.close();
}
fs.writeFileSync(path.join(outDir, "verify_all.json"), JSON.stringify(summary, null, 2));
await browser.close();
