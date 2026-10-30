// Measures the REAL game (running on 127.0.0.1:3917, local stand-in DB, /api mocked) at a 720x1280 viewport and writes
//   refs/game_<screen>.png            (capture used for the overlay)
//   screens/<screen>.ts               (element list with real pictures / strings / fonts)
//   ../../web/src/game/layout_<screen>.ts (coordinates in game px, same format as layout_round1.ts)
// DOM screens (intro, result_*, ranking, email_*) are measured exactly (getBoundingClientRect). Phaser screens
// (play, final_grabbed) are written by hand in hand_screens.mjs from the scene constants.
// usage: node extract.mjs [lang=ko]
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { chromium } from "playwright";
import { emitScreen } from "./emit.mjs";

const here = path.dirname(fileURLToPath(import.meta.url));
const lang = process.argv[2] || "ko";
const BASE = "http://localhost:3917/c/2026-10-25?lang=" + lang;
const ROWS = [
  ["Calm Toast", 21],
  ["Lucky Fox", 34],
  ["Quiet Owl", 90],
  ["Brave Moth", 144],
  ["Sleepy Duck", 310],
].map(([nickname, errorMs], i) => ({ nickname, errorMs, rank: i + 1, isMe: i === 1 }));

const FINISH = {
  late: { outcome: "lose", outcomeVariant: "late", roundErrorsMs: [140, 410, 230], errorMs: 780, bestErrorMs: 780, isNewBest: true, globalRank: 2, friendsRank: null },
  early: { outcome: "lose", outcomeVariant: "early", roundErrorsMs: [140, 410, 230], errorMs: 780, bestErrorMs: 780, isNewBest: true, globalRank: 2, friendsRank: null },
  win: { outcome: "win", outcomeVariant: null, roundErrorsMs: [8, 5, 8], errorMs: 21, bestErrorMs: 21, isNewBest: true, globalRank: 2, friendsRank: null },
};

// ---- element specs (selector -> name). Order = stacking order. -------------------------------------------------
const T = (name, sel, extra = {}) => ({ name, sel, kind: "text", ...extra });
const B = (name, sel, extra = {}) => ({ name, sel, kind: "box", ...extra });
const I = (name, sel, extra = {}) => ({ name, sel, kind: "image", ...extra });

const resultSpecs = (duck) => [
  B("chip", ".rs-chip"),
  B("lang_toggle", ".rs-lang"),
  T("caption_top", ".rs-cap", { nth: 0 }),
  T("verdict", ".rs-verdict .v"),
  T("score", ".rs-verdict .s"),
  B("badge", ".rs-verdict .b"),
  I("hero", "img.rs-hero"),
  ...(duck ? [I("duck", "img.rs-duck", { animated: true, note: "추정: 흔들리는 애니메이션의 첫 프레임 기준" })] : []),
  T("caption_bottom", ".rs-cap", { nth: 1 }),
  B("btn_retry", ".rs-btns .rs-go", { nth: 0 }),
  B("btn_rank", ".rs-btns .rs-go", { nth: 1 }),
];

const SCREENS = {
  intro: { label: "시작 화면(intro)", bg: "bg_office.webp", root: "[data-testid=intro-screen]", specs: [
    B("lang_toggle", ".rs-lang"),
    T("title", ".rs-cap", { nth: 0 }),
    T("subtitle", ".rs-cap", { nth: 1 }),
    T("description", ".rs-line"),
    I("hero", ".anim-jitter", { animated: true }),
    B("btn_start", ".rs-btns .rs-go"),
  ] },
  result_late: { label: "결과: TOO LATE", bg: "bg_office.webp", root: "[data-testid=result-screen]", specs: resultSpecs(true) },
  result_early: { label: "결과: TOO EARLY", bg: "bg_office.webp", root: "[data-testid=result-screen]", specs: resultSpecs(true) },
  result_perfect: { label: "결과: PERFECT", bg: "bg_office.webp", root: "[data-testid=result-screen]", specs: resultSpecs(false) },
  ranking: { label: "랭킹", bg: "bg_office.webp", root: "[data-testid=rank-screen]", specs: [
    B("panel", ".rk-wrap", { noText: true }),
    B("btn_back", ".rk-back"),
    B("lang_toggle", ".rs-lang"),
    I("trophy", ".rk-title img"),
    T("title", ".rk-title"),
    ...[0, 1, 2, 3, 4].flatMap((i) => [
      B(`row${i + 1}`, ".rk-list li", { nth: i, noText: true }),
      T(`row${i + 1}_rank`, ".rk-list li b", { nth: i }),
      T(`row${i + 1}_name`, ".rk-list li span.n", { nth: i, alignLeft: true }),
      T(`row${i + 1}_time`, ".rk-list li em", { nth: i }),
    ]),
    T("help", ".rk-help"),
    B("btn_email", ".rk-bottom .rs-go", { nth: 0 }),
    B("btn_share", ".rk-bottom .rs-go.ghost"),
  ] },
};
const emailSpecs = (state) => {
  if (state === "sent") {
    return [T("caption", ".rs-cap"), I("hero", "img.rs-hero"), B("btn_again", ".rs-btns .rs-go", { nth: 0 }), B("btn_rank", ".rs-btns .rs-go", { nth: 1 })];
  }
  return [
    B("btn_back", ".rk-back"),
    T("title", ".rs-cap", { nth: 0 }),
    T("subtitle", ".rs-cap", { nth: 1, optional: true }),
    I("hero", ".rs-group > img:first-child"),
    I("paper_pile", ".rs-pile", { optional: true, note: "추정: 기울어진 이미지의 레이아웃 박스 기준" }),
    B("error_line", ".rs-errl", { visibleOnly: true }),
    B("input", ".rs-form input", { placeholder: true }),
    B("btn_submit", ".rs-form .rs-go"),
    T("help", ".rs-form .rk-help"),
    T("legal", ".rs-legal", { visibleOnly: true }),
  ];
};
for (const st of ["input", "invalid", "failed", "sent"]) {
  SCREENS["email_" + st] = { label: "이메일: " + { input: "입력", invalid: "주소 오류", failed: "저장 실패", sent: "보냄" }[st], bgCss: "EMAIL_BG", root: "[data-testid=email-screen]", specs: emailSpecs(st) };
}

// ---- in-page measurement ---------------------------------------------------------------------------------------
async function measure(page, screenId) {
  const def = SCREENS[screenId];
  return page.evaluate(
    ({ root, specs }) => {
      document.getAnimations().forEach((a) => {
        a.pause();
        a.currentTime = 0;
      });
      const box = document.querySelector(".play-box").getBoundingClientRect();
      const k = 720 / box.width;
      const hex = (c) => c;
      const rootEl = document.querySelector(root);
      const out = [];
      const bgCss = (() => {
        const cs = getComputedStyle(rootEl);
        return cs.backgroundImage !== "none" ? cs.backgroundImage : cs.backgroundColor;
      })();
      for (const sp of specs) {
        const all = [...rootEl.querySelectorAll(sp.sel)];
        const el = all[sp.nth ?? 0] || (sp.nth ? null : null);
        if (!el) {
          if (!sp.optional) out.push({ name: sp.name, missing: true });
          continue;
        }
        const cs = getComputedStyle(el);
        if (cs.visibility === "hidden" && sp.visibleOnly) continue;
        const r = el.getBoundingClientRect();
        let w = r.width * k;
        let h = r.height * k;
        if (sp.animated) {
          w = el.offsetWidth * k;
          h = el.offsetHeight * k;
        }
        const x = ((r.left + r.right) / 2 - box.left) * k;
        const y = ((r.top + r.bottom) / 2 - box.top) * k;
        const item = { name: sp.name, kind: sp.kind, x, y, w, h, def: {} };
        if (sp.note) item.def.note = sp.note;
        const num = (v) => Math.round(parseFloat(v) * k * 10) / 10;
        if (sp.kind === "image") {
          item.def.src = (el.currentSrc || el.src || "").split("/").pop().split("?")[0];
        } else {
          let text = "";
          const hasSpanColor = [...el.children].some((c) => c.tagName === "SPAN");
          if (hasSpanColor && !sp.noText) {
            text = [...el.childNodes].map((n) => (n.nodeType === 3 ? n.textContent : `[[${n.textContent}]]`)).join("").replace(/\s+/g, " ").trim();
            const up = cs.textTransform === "uppercase";
            if (up) text = text.toUpperCase();
          } else if (!sp.noText) {
            text = (sp.placeholder ? el.value || el.placeholder : el.innerText).replace(/\s*\n\s*/g, sp.sel === ".rs-lang" ? "   " : " ").trim();
          }
          item.text = text;
          if (sp.placeholder) {
            item.def.color = el.value ? cs.color : getComputedStyle(el, "::placeholder").color;
            item.def.align = cs.textAlign === "center" ? "center" : "left";
          } else item.def.color = cs.color;
          item.font = num(cs.fontSize);
          item.def.family = cs.fontFamily.includes("Anton") || /caption/.test(cs.fontFamily) ? "anton" : "sans";
          if (cs.fontFamily.includes("Anton")) item.def.family = "anton";
          else item.def.family = "sans";
          item.def.weight = parseInt(cs.fontWeight, 10);
          const sw = num(cs.webkitTextStrokeWidth);
          if (sw > 0) {
            item.def.stroke = sw;
            item.def.strokeColor = cs.webkitTextStrokeColor;
          }
          if (cs.textShadow && cs.textShadow !== "none") item.def.shadow = cs.textShadow.replace(/(-?[\d.]+)px/g, (m, v) => `${Math.round(parseFloat(v) * k * 10) / 10}px`);
          if (!sp.placeholder) item.def.align = sp.alignLeft ? "left" : cs.textAlign === "left" || cs.textAlign === "start" ? (sp.kind === "box" ? "center" : "center") : cs.textAlign;
          if (sp.kind === "box") {
            item.def.fill = cs.backgroundImage !== "none" ? cs.backgroundImage : cs.backgroundColor;
            const bw = num(cs.borderTopWidth);
            if (bw > 0) {
              item.def.borderW = bw;
              item.def.border = cs.borderTopColor;
            }
            item.def.radius = Math.min(num(cs.borderTopLeftRadius), Math.min(w, h) / 2);
          }
          if (sp.kind === "text" && sp.name !== "x") item.def.align = item.def.align || "center";
          if (text === "" && sp.kind === "text") {
            continue;
          }
        }
        out.push(item);
      }
      return { items: out, bgCss };
    },
    { root: def.root, specs: def.specs },
  );
}

function mockRoutes(page, state) {
  page.route("**/api/**", (route) => {
    const u = new URL(route.request().url());
    const p = u.pathname;
    let body = {};
    let status = 200;
    if (p.endsWith("/finish")) {
      state.finished = true;
      body = FINISH[state.outcome];
    } else if (p === "/api/leaderboard") body = { rows: ROWS, myRank: 2, gapMs: 200 };
    else if (p === "/api/referrals") body = { url: "https://example.test/c/x", referralId: "abc" };
    else if (p === "/api/subscribe") {
      status = state.subscribe === "fail" ? 500 : 200;
      body = status === 200 ? { ok: true } : { error: "mock" };
    } else return route.fallback();
    route.fulfill({ status, contentType: "application/json", body: JSON.stringify(body) });
  });
}

const shotDir = path.join(here, "refs");
const results = {};
async function record(page, screenId, shotName) {
  await page.waitForTimeout(500);
  const m = await measure(page, screenId);
  await page.screenshot({ path: path.join(shotDir, `game_${shotName || screenId}.png`) });
  results[screenId] = m;
  const missing = m.items.filter((i) => i.missing).map((i) => i.name);
  console.log(screenId, "elements:", m.items.filter((i) => !i.missing).length, missing.length ? "MISSING " + missing : "");
}

const browser = await chromium.launch({ args: ["--use-gl=swiftshader", "--ignore-gpu-blocklist"] });
async function session(outcome, fn) {
  const ctx = await browser.newContext({ viewport: { width: 720, height: 1280 } });
  const page = await ctx.newPage();
  const state = { outcome, finished: false, subscribe: "ok" };
  mockRoutes(page, state);
  await page.goto(BASE, { waitUntil: "domcontentloaded" });
  await page.waitForSelector("[data-testid=intro-screen]");
  await page.waitForTimeout(1500);
  await fn(page, state);
  await ctx.close();
}
const startBtn = lang === "ko" ? "지금 플레이" : "Play now";
const rankBtn = lang === "ko" ? "내 순위 보기" : "See my rank";
const emailBtn = lang === "ko" ? "밈 게임 메일로 받기" : "Email me this game";

async function playToResult(page, state, grabShots) {
  await page.getByRole("button", { name: startBtn }).click();
  await page.waitForTimeout(1500);
  if (grabShots) await page.screenshot({ path: path.join(shotDir, "game_countdown.png") });
  await page.waitForTimeout(3300);
  if (grabShots) await page.screenshot({ path: path.join(shotDir, "game_play.png") });
  let shotFinal = false;
  for (let i = 0; i < 80; i++) {
    if (await page.locator("[data-testid=result-screen]").count()) break;
    await page.keyboard.press("Space");
    await page.waitForTimeout(900);
    if (state.finished && grabShots && !shotFinal) {
      await page.waitForTimeout(grabShots === "early" ? 600 : 900);
      await page.screenshot({ path: path.join(shotDir, `game_final_${grabShots}.png`) });
      shotFinal = true;
    }
  }
  await page.waitForSelector("[data-testid=result-screen]", { timeout: 25000 });
  await page.waitForTimeout(600);
}

await session("late", async (page, state) => {
  await record(page, "intro");
  await playToResult(page, state, "late");
  await record(page, "result_late");
  await page.getByRole("button", { name: rankBtn }).click();
  await page.waitForSelector("[data-testid=rank-screen]");
  await page.waitForTimeout(600);
  await record(page, "ranking");
  await page.getByRole("button", { name: emailBtn }).first().click();
  await page.waitForSelector("[data-testid=email-screen]");
  await record(page, "email_input");
  await page.locator("input[type=email]").fill("abc");
  await page.locator(".rs-form .rs-go").click();
  await page.waitForSelector("[data-state=invalid]");
  await record(page, "email_invalid");
  state.subscribe = "fail";
  await page.locator("input[type=email]").fill("tester@example.com");
  await page.locator(".rs-form .rs-go").click();
  await page.waitForSelector("[data-state=failed]");
  await record(page, "email_failed");
  state.subscribe = "ok";
  await page.locator(".rs-form .rs-go").click();
  await page.waitForSelector("[data-state=sent]");
  await record(page, "email_sent");
});
await session("early", async (page, state) => {
  await playToResult(page, state, "early");
  await record(page, "result_early");
});
await session("win", async (page, state) => {
  await playToResult(page, state, "win");
  await record(page, "result_perfect");
});
await browser.close();

fs.mkdirSync(path.join(here, "out"), { recursive: true });
fs.writeFileSync(path.join(here, "out", "extract.json"), JSON.stringify(results, null, 2));
for (const [id, m] of Object.entries(results)) {
  emitScreen(here, id, SCREENS[id], m);
}
console.log("done");
