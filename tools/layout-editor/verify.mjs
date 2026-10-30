// Headless check of the editor (needs the dev server on 127.0.0.1:5183). node verify.mjs <screenshot.png>
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { chromium } from "playwright";

const here = path.dirname(fileURLToPath(import.meta.url));
const shot = process.argv[2] || path.join(here, "out", "editor_round1.png");
const browser = await chromium.launch();
const page = await browser.newPage({ viewport: { width: 1500, height: 1000 } });
const errors = [];
page.on("pageerror", (e) => errors.push(String(e)));
await page.goto("http://127.0.0.1:5183/");
await page.waitForFunction(() => window.__editor && window.__editor.getCurrentPageShapes().length >= 13, null, { timeout: 30000 });
await page.waitForTimeout(1500);
const result = {};
const count = () => page.evaluate(() => window.__editor.getCurrentPageShapes().filter((s) => s.type === "game-element" && !s.props.name.startsWith("__")).length);
result.elements = await count();
result.countLabel = await page.textContent("[data-testid=count]");
const sel = (name) => page.evaluate((n) => { window.__editor.select("shape:" + n); }, name);
const panel = (f) => page.inputValue(`[data-field="${f}"]`);

// 2) programmatic +10px move of button, panel follows
await sel("button");
const x0 = Number(await panel("x"));
const y0 = Number(await panel("y"));
await page.evaluate(() => {
  const ed = window.__editor;
  const s = ed.getShape("shape:button");
  ed.updateShape({ id: s.id, type: s.type, y: s.y + 10 });
});
await page.waitForTimeout(300);
result.button_y_before = y0;
result.button_y_after = Number(await panel("y"));
result.button_x_unchanged = Number(await panel("x")) === x0;

// 3) type y into the panel
await page.fill('[data-field="y"]', "900");
await page.waitForTimeout(300);
result.panel_typed_y = 900;
result.shape_y_game = await page.evaluate(() => { const s = window.__editor.getShape("shape:button"); return s.y + s.props.h / 2; });

// arrow key nudge + undo
await page.evaluate(() => (document.activeElement && document.activeElement.blur && document.activeElement.blur()));
const c = await page.evaluate(() => { const ed = window.__editor; const b = ed.getShapePageBounds("shape:button"); const p = ed.pageToViewport(b.center); const r = document.querySelector("[data-testid=canvas]").getBoundingClientRect(); return { x: p.x + r.left, y: p.y + r.top }; });
await page.mouse.click(c.x, c.y);
result.click_selects = await page.evaluate(() => window.__editor.getOnlySelectedShape()?.props.name);
await page.keyboard.press("ArrowDown");
await page.waitForTimeout(200);
result.arrow_down_1px = await page.evaluate(() => { const s = window.__editor.getShape("shape:button"); return s.y + s.props.h / 2; });
await page.keyboard.press("Shift+ArrowDown");
await page.waitForTimeout(200);
result.shift_arrow_10px = await page.evaluate(() => { const s = window.__editor.getShape("shape:button"); return s.y + s.props.h / 2; });
await page.keyboard.press("Control+z");
await page.waitForTimeout(200);
result.after_ctrl_z = await page.evaluate(() => { const s = window.__editor.getShape("shape:button"); return s.y + s.props.h / 2; });

// overlay toggle
await page.check("text=게임 캡처 겹쳐 보기 >> input");
await page.waitForTimeout(500);
result.overlay_shape = await page.evaluate(() => !!window.__editor.getShape("shape:__ref"));
await page.waitForTimeout(500);
await page.screenshot({ path: shot.replace(".png", "_overlay.png") });
await page.uncheck("text=게임 캡처 겹쳐 보기 >> input");

// 4) save (restore button first so the saved file is the original positions)
await page.evaluate(() => { window.__editor.undo(); });
await page.waitForTimeout(200);
await page.click("[data-testid=save]");
await page.waitForFunction(() => document.querySelector("[data-testid=status]").textContent.startsWith("저장됨"), null, { timeout: 10000 });
result.status = await page.textContent("[data-testid=status]");
const out = path.join(here, "out", "layout_round1.json");
result.json_exists = fs.existsSync(out);
if (result.json_exists) result.json_keys = Object.keys(JSON.parse(fs.readFileSync(out, "utf8"))).length;

// watermark text
result.watermark_text = await page.evaluate(() => {
  const el = [...document.querySelectorAll("a, div, span")].find((e) => /license|tldraw/i.test(e.textContent || "") && e.children.length === 0);
  return el ? el.textContent.trim().slice(0, 80) : null;
});
await page.evaluate(() => { window.__editor.selectNone(); });
await page.waitForTimeout(300);
fs.mkdirSync(path.dirname(shot), { recursive: true });
await page.screenshot({ path: shot });
result.pageErrors = errors;
console.log(JSON.stringify(result, null, 2));
await browser.close();
