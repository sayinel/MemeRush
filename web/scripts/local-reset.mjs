// Clears the local stand-in DB and the temporary email list (test players, attempts, subscribers).
// Run after local verification, then restart the server (it keeps state in memory):  node scripts/local-reset.mjs
import fs from "node:fs";
fs.rmSync(new URL("../.data", import.meta.url), { recursive: true, force: true });
console.log("web/.data removed; restart the server to re-seed the fictional ranking");
