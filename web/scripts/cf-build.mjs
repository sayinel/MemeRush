// Public (Cloudflare) build: temporarily moves the routes that must not exist in public deploys
// (/admin, /api/admin/*, /api/videos = ffmpeg) out of src/app, runs the OpenNext build, then restores them.
// Local PC demo server (npm run dev/build/start) is untouched and keeps these routes.
import { spawnSync } from "node:child_process";
import { existsSync, mkdirSync, renameSync, rmSync } from "node:fs";

const EXCLUDE = ["src/app/admin", "src/app/api/admin", "src/app/api/videos"];
const STASH = ".cf-stash";
const moved = [];
function restore() {
  for (const p of moved.reverse()) {
    mkdirSync(p.split("/").slice(0, -1).join("/"), { recursive: true });
    renameSync(`${STASH}/${p}`, p);
  }
  rmSync(STASH, { recursive: true, force: true });
}
process.on("SIGINT", () => { restore(); process.exit(130); });

let code = 1;
try {
  spawnSync("node", ["scripts/gen-challenges.mjs"], { stdio: "inherit" });
  for (const p of EXCLUDE) {
    if (!existsSync(p)) continue;
    mkdirSync(`${STASH}/${p.split("/").slice(0, -1).join("/")}`, { recursive: true });
    renameSync(p, `${STASH}/${p}`);
    moved.push(p);
  }
  const args = process.argv.slice(2);
  code = spawnSync("npx", ["opennextjs-cloudflare", "build", ...args], { stdio: "inherit", shell: true }).status ?? 1;
} finally {
  restore();
}
process.exit(code);
