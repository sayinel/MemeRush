// layout_*.ts <-> object. Shared by the dev server (initial values) and apply_layout.mjs (write back).
// Only touches the `name: { x: .., y: .., w: .., h: .. [, font: ..] },` lines; comments and order are kept.
const LINE = /^(\s*)(\w+)(:\s*\{\s*)(.*?)(\s*\},?)(\s*(?:\/\/.*)?)$/;
const KEYS = ["x", "y", "w", "h", "font"];

function isEntry(m) {
  return !!m && /\bx:\s*-?\d/.test(m[4]);
}

export function parseLayoutTs(src) {
  const out = {};
  for (const line of src.split(/\r?\n/)) {
    const m = LINE.exec(line);
    if (!isEntry(m)) continue;
    const o = {};
    for (const kv of m[4].split(",")) {
      const [k, v] = kv.split(":").map((s) => s.trim());
      if (k && KEYS.includes(k) && v !== undefined && v !== "" && !Number.isNaN(Number(v))) o[k] = Number(v);
    }
    out[m[2]] = o;
  }
  return out;
}

const fmt = (n) => String(Math.round(n * 100) / 100);

export function rewriteLayoutTs(src, values) {
  const names = new Set(Object.keys(parseLayoutTs(src)));
  const unknown = Object.keys(values).filter((k) => !names.has(k));
  const missing = [...names].filter((k) => !(k in values));
  if (unknown.length || missing.length) {
    throw new Error(`element names do not match. only in json: [${unknown}] only in ts: [${missing}]`);
  }
  const eol = src.includes("\r\n") ? "\r\n" : "\n";
  return src
    .split(/\r?\n/)
    .map((line) => {
      const m = LINE.exec(line);
      if (!isEntry(m)) return line;
      const v = values[m[2]];
      const hadFont = /\bfont:/.test(m[4]);
      for (const k of ["x", "y", "w", "h"]) if (typeof v[k] !== "number") throw new Error(`${m[2]}.${k} is not a number`);
      if (hadFont && typeof v.font !== "number") throw new Error(`${m[2]}.font is missing`);
      const keys = hadFont ? ["x", "y", "w", "h", "font"] : ["x", "y", "w", "h"];
      const body = keys.map((k) => `${k}: ${fmt(v[k])}`).join(", ");
      return `${m[1]}${m[2]}${m[3]}${body}${m[5]}${m[6]}`;
    })
    .join(eol);
}
