import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import react from "@vitejs/plugin-react";
import { defineConfig } from "vite";
import { parseLayoutTs } from "./lib_layoutTs.mjs";

const here = path.dirname(fileURLToPath(import.meta.url));
const gameDir = path.resolve(here, "..", "..", "web", "public", "game");
const layoutDir = path.resolve(here, "..", "..", "web", "src", "game");
const safe = (s) => /^[A-Za-z0-9_.-]+$/.test(s || "");
const MIME = { ".png": "image/png", ".webp": "image/webp", ".jpg": "image/jpeg", ".json": "application/json" };


// ---- 버전 보관: out/versions/<화면id>/v0001.json ... (지우지 않고 쌓기만 한다) ----
const outDir = path.join(here, "out");
const verDir = (lid) => path.join(outDir, "versions", lid);
const verFiles = (lid) => {
  const d = verDir(lid);
  return fs.existsSync(d) ? fs.readdirSync(d).filter((f) => /^v\d{4,}\.json$/.test(f)).sort() : [];
};
function writeVersion(lid, data, note) {
  const d = verDir(lid);
  fs.mkdirSync(d, { recursive: true });
  const n = verFiles(lid).length ? parseInt(verFiles(lid).slice(-1)[0].slice(1, -5), 10) + 1 : 1;
  const name = `v${String(n).padStart(4, "0")}.json`;
  fs.writeFileSync(path.join(d, name), JSON.stringify({ version: n, savedAt: new Date().toISOString(), note: note || "", data }, null, 2) + "\n", { flag: "wx" });
  return n;
}
// 첫 실행: 버전 폴더가 없는 기존 layout_*.json을 v0001(최초 가져옴)로 복사 편입(원본은 건드리지 않는다)
function importExisting() {
  if (!fs.existsSync(outDir)) return;
  for (const f of fs.readdirSync(outDir)) {
    const m = /^layout_([A-Za-z0-9_.-]+)\.json$/.exec(f);
    if (!m || verFiles(m[1]).length) continue;
    try {
      writeVersion(m[1], JSON.parse(fs.readFileSync(path.join(outDir, f), "utf8")), "최초 가져옴");
    } catch {}
  }
}

// Local-only helper API: serves game art + refs, loads initial values, saves out/layout_<screen>.json.
function localApi() {
  return {
    name: "layout-editor-local-api",
    configureServer(server) {
      importExisting();
      server.middlewares.use((req, res, next) => {
        const url = new URL(req.url, "http://127.0.0.1");
        const send = (code, body, type = "application/json") => {
          res.statusCode = code;
          res.setHeader("content-type", type);
          res.end(body);
        };
        const sendFile = (dir, name) => {
          const f = path.join(dir, name);
          if (!safe(name) || !fs.existsSync(f)) return send(404, "not found", "text/plain");
          send(200, fs.readFileSync(f), MIME[path.extname(f).toLowerCase()] || "application/octet-stream");
        };
        if (url.pathname.startsWith("/game/")) return sendFile(gameDir, url.pathname.slice(6));
        if (url.pathname.startsWith("/refs/")) return sendFile(path.join(here, "refs"), decodeURIComponent(url.pathname.slice(6)));
        if (url.pathname === "/api/refs") {
          const dir = path.join(here, "refs");
          const files = fs.existsSync(dir) ? fs.readdirSync(dir).filter((f) => /\.(png|jpg|webp)$/i.test(f)) : [];
          return send(200, JSON.stringify(files));
        }
        const screen = url.searchParams.get("screen");
        if (url.pathname === "/api/load") {
          if (!safe(screen)) return send(400, "{}");
          const saved = path.join(here, "out", `layout_${screen}.json`);
          const ts = path.join(layoutDir, `layout_${screen}.ts`);
          return send(
            200,
            JSON.stringify({
              saved: fs.existsSync(saved) ? JSON.parse(fs.readFileSync(saved, "utf8")) : null,
              initial: fs.existsSync(ts) ? parseLayoutTs(fs.readFileSync(ts, "utf8")) : {},
            }),
          );
        }
        if (url.pathname === "/api/versions") {
          if (!safe(screen)) return send(400, "[]");
          const list = verFiles(screen).map((f) => {
            const j = JSON.parse(fs.readFileSync(path.join(verDir(screen), f), "utf8"));
            return { n: j.version, savedAt: j.savedAt, note: j.note };
          });
          return send(200, JSON.stringify(list));
        }
        if (url.pathname === "/api/version") {
          const n = parseInt(url.searchParams.get("n") || "", 10);
          const f = path.join(verDir(screen || ""), `v${String(n).padStart(4, "0")}.json`);
          if (!safe(screen) || !fs.existsSync(f)) return send(404, "{}");
          return send(200, fs.readFileSync(f));
        }
        if (url.pathname === "/api/revert" && req.method === "POST") {
          const n = parseInt(url.searchParams.get("n") || "", 10);
          const f = path.join(verDir(screen || ""), `v${String(n).padStart(4, "0")}.json`);
          if (!safe(screen) || !fs.existsSync(f)) return send(404, "{}");
          const data = JSON.parse(fs.readFileSync(f, "utf8")).data;
          fs.writeFileSync(path.join(outDir, `layout_${screen}.json`), JSON.stringify(data, null, 2) + "\n");
          const version = writeVersion(screen, data, `v${n}으로 되돌림`);
          return send(200, JSON.stringify({ ok: true, version }));
        }
        if (url.pathname === "/api/save" && req.method === "POST") {
          if (!safe(screen)) return send(400, "{}");
          let body = "";
          req.on("data", (c) => (body += c));
          req.on("end", () => {
            try {
              const data = JSON.parse(body);
              fs.mkdirSync(path.join(here, "out"), { recursive: true });
              const file = path.join(here, "out", `layout_${screen}.json`);
              fs.writeFileSync(file, JSON.stringify(data, null, 2) + "\n");
              const version = writeVersion(screen, data, url.searchParams.get("note") || "");
              send(200, JSON.stringify({ ok: true, file, count: Object.keys(data).length, version }));
            } catch (e) {
              send(400, JSON.stringify({ ok: false, error: String(e) }));
            }
          });
          return;
        }
        next();
      });
    },
  };
}

export default defineConfig({
  plugins: [react(), localApi()],
  server: { host: "127.0.0.1", port: 5183, allowedHosts: [".ts.net"], strictPort: true, fs: { strict: true } },
});
