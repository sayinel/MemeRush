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

// Local-only helper API: serves game art + refs, loads initial values, saves out/layout_<screen>.json.
function localApi() {
  return {
    name: "layout-editor-local-api",
    configureServer(server) {
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
              send(200, JSON.stringify({ ok: true, file, count: Object.keys(data).length }));
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
