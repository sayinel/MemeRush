// Shared mail pieces (colors, top strip, bulletproof buttons, footer text). Pure functions, no dependencies,
// so node tests and the Next build can both import them. Rules: table layout, inline styles only, min font 12px.

export const IMG_BASE = "https://memerush.superagents.run/mail";
export const C = { bg: "#140C09", card: "#1E1410", orange: "#FF6A2B", amber: "#FFB547", cream: "#FFF3E6", soft: "#C9B8A6", line: "#3A2A21", foot: "#9C8B7A" };
export const FONT = "'Apple SD Gothic Neo','Malgun Gothic',Arial,Helvetica,sans-serif";
export const WB = "word-break:keep-all;";

export function esc(s: unknown): string {
  return String(s ?? "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

export const p = (size: number, color: string, extra = "") => `margin:0;font-family:${FONT};font-size:${size}px;line-height:1.6;color:${color};${WB}${extra}`;

// Top strip: "MEME RUSH" on the left (plus optional label), optional right-hand text. Inputs must be escaped by the caller.
export function topStrip(leftExtra = "", right = ""): string {
  return (
    `<tr><td style="padding:12px 20px;border-bottom:1px solid ${C.line};"><table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0"><tr>` +
    `<td style="font-family:${FONT};font-size:12px;letter-spacing:1px;color:${C.soft};"><b style="color:${C.amber};">MEME RUSH</b>${leftExtra}</td>` +
    (right ? `<td align="right" style="font-family:${FONT};font-size:12px;color:${C.soft};">${right}</td>` : "") +
    `</tr></table></td></tr>`
  );
}

// Big orange bulletproof button (table + a, 56px high). href and label must be escaped by the caller.
export function bigButton(href: string, label: string): string {
  return (
    `<table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0"><tr>` +
    `<td align="center" bgcolor="${C.orange}" height="56" style="height:56px;background:${C.orange};border-radius:14px;">` +
    `<a href="${href}" style="display:block;line-height:56px;height:56px;font-family:${FONT};font-size:18px;font-weight:800;color:${C.bg};text-decoration:none;${WB}">${label}</a>` +
    `</td></tr></table>`
  );
}

// Outline secondary button (44px high). href and label must be escaped by the caller.
export function outlineButton(href: string, label: string): string {
  return (
    `<table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0"><tr>` +
    `<td align="center" height="44" style="height:44px;border:2px solid ${C.orange};border-radius:12px;">` +
    `<a href="${href}" style="display:block;line-height:44px;height:44px;font-family:${FONT};font-size:15px;font-weight:700;color:${C.orange};text-decoration:none;${WB}">${label}</a>` +
    `</td></tr></table>`
  );
}

export function banner(href: string, alt: string): string {
  return `<tr><td><a href="${href}" style="text-decoration:none;"><img src="${IMG_BASE}/banner.jpg" width="600" alt="${alt}" style="display:block;width:100%;max-width:600px;height:auto;border:0;"></a></td></tr>`;
}

// Whole-mail wrapper: dark page, 600px column. Content is rows (<tr>...</tr>).
export function shell(lang: string, title: string, preheader: string, rows: string): string {
  return (
    `<!doctype html><html lang="${lang}"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">` +
    `<meta name="color-scheme" content="dark"><title>${esc(title)}</title></head>` +
    `<body style="margin:0;padding:0;background:${C.bg};">` +
    `<div style="display:none;max-height:0;overflow:hidden;opacity:0;color:${C.bg};font-size:12px;line-height:12px;">${esc(preheader)}</div>` +
    `<table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="background:${C.bg};"><tr><td align="center">` +
    `<table role="presentation" width="600" cellpadding="0" cellspacing="0" border="0" style="width:600px;max-width:100%;background:${C.bg};color:${C.cream};">` +
    rows +
    `</table></td></tr></table></body></html>`
  );
}

// Footer row with small text (12px, #9C8B7A). Inner HTML must be escaped by the caller.
export function footerRow(inner: string): string {
  return `<tr><td style="padding:20px;border-top:1px solid ${C.line};font-family:${FONT};font-size:12px;line-height:1.7;color:${C.foot};${WB}">${inner}</td></tr>`;
}
