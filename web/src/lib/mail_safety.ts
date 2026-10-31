// Address checks for the subscription flow. Pure module (no imports) so node:test can load it directly.
// Never log the values these functions handle (personal data).

// C0 controls, DEL, and the Unicode line/paragraph separators. Any of these in an address or header value could split
// a mail header or a log line, so such input is rejected (addresses) or removed (header values).
const CONTROL = /[\u0000-\u001f\u007f\u2028\u2029]/;
const CONTROL_ALL = /[\u0000-\u001f\u007f\u2028\u2029]+/g;

// Local part: printable ASCII without space, quotes, angle brackets, comma, semicolon, colon, backslash.
// Domain: dot-separated ASCII labels (IDN must be given as punycode), at least one dot.
const EMAIL = /^[A-Za-z0-9!#$%&*+/=?^_`{|}~.-]{1,64}@[a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?(?:\.[a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?)+$/;

export function hasControlChars(s: string): boolean {
  return CONTROL.test(s);
}

// Header-safe value: control characters (CR/LF included) are removed, surrounding space trimmed.
export function headerSafe(s: string): string {
  return s.replace(CONTROL_ALL, "").trim();
}

// Returns the lower-cased address, or null when it is not one we accept. Control characters are rejected rather than
// stripped, so "a@b.com\r\nBcc: x" never becomes a different valid address.
export function parseEmail(raw: unknown): string | null {
  if (typeof raw !== "string") return null;
  if (hasControlChars(raw)) return null;
  const email = raw.trim().toLowerCase();
  if (email.length > 254 || !EMAIL.test(email)) return null;
  if (email.startsWith(".") || email.includes("..") || email.split("@")[0].endsWith(".")) return null;
  return email;
}

const GMAIL = new Set(["gmail.com", "googlemail.com"]);

// One key per real inbox: lower case, "+tag" removed, and for Gmail the dots in the local part removed (Gmail ignores
// them) with googlemail.com folded into gmail.com. Used only to find duplicates; mail still goes to the typed address.
export function normalizeEmail(email: string): string {
  const e = email.trim().toLowerCase();
  const at = e.lastIndexOf("@");
  if (at < 1) return e;
  let local = e.slice(0, at);
  let domain = e.slice(at + 1);
  const plus = local.indexOf("+");
  if (plus > 0) local = local.slice(0, plus);
  if (GMAIL.has(domain)) {
    local = local.replace(/\./g, "");
    domain = "gmail.com";
  }
  return `${local}@${domain}`;
}

// For any place that writes a request URL to a log: token-like query values are replaced.
const SECRET_PARAMS = ["token", "league", "ref", "rid"];
export function redactUrl(url: string): string {
  try {
    const u = new URL(url);
    for (const k of SECRET_PARAMS) if (u.searchParams.has(k)) u.searchParams.set(k, "REDACTED");
    return u.toString();
  } catch {
    return "[unparseable url]";
  }
}
