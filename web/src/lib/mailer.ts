// Azure Communication Services (ACS) Email sender. Workers compatible: fetch + Web Crypto only, no Node APIs.
// Pure module (config is passed in) so it can be unit tested; see mail_env.ts for reading the Cloudflare bindings.
// Never log the key, the request body or the recipient address.

export type MailEnv = {
  ACS_ENDPOINT?: string; // https://<resource>.communication.azure.com
  ACS_ACCESS_KEY?: string; // secret (base64 string from the Azure portal)
  MAIL_SENDER?: string; // from address, default memerush@superagents.run
  MAIL_ENABLED?: string; // sends only when exactly "1"
};

export const DEFAULT_SENDER = "memerush@superagents.run";
export const API_VERSION = "2023-03-31"; // [확인 필요] the api-version the Send API accepts; 2023-03-31 is the GA one as far as I know.

// headers: extra mail headers (e.g. List-Unsubscribe). [확인 필요] ACS Send body field "headers" (name -> value).
export type MailMessage = { to: string; subject: string; text: string; html: string; headers?: Record<string, string> };
export type SendResult =
  | { ok: true; operationId?: string }
  | { ok: false; reason: "disabled" | "not_configured" | "http_4xx" | "http_5xx" | "unexpected_status" | "network" | "invalid_recipient" };

// Header injection guard: an address or header value with CR/LF (or any control character) could add headers.
const CONTROL = /[\u0000-\u001f\u007f\u2028\u2029]/;
const CONTROL_ALL = /[\u0000-\u001f\u007f\u2028\u2029]+/g;
const HEADER_NAME = /^[A-Za-z0-9-]{1,64}$/;
const clean = (s: string) => s.replace(CONTROL_ALL, "").trim();
export function safeHeaders(h: Record<string, string> | undefined): Record<string, string> | undefined {
  if (!h) return undefined;
  const out: Record<string, string> = {};
  for (const [k, v] of Object.entries(h)) if (HEADER_NAME.test(k) && typeof v === "string") out[k] = clean(v);
  return Object.keys(out).length ? out : undefined;
}

const enc = new TextEncoder();

function toB64(bytes: Uint8Array): string {
  let s = "";
  for (const b of bytes) s += String.fromCharCode(b);
  return btoa(s);
}
function fromB64(s: string): Uint8Array<ArrayBuffer> {
  const bin = atob(s);
  const out = new Uint8Array(new ArrayBuffer(bin.length));
  for (let i = 0; i < bin.length; i++) out[i] = bin.charCodeAt(i);
  return out;
}

export async function sha256B64(body: string): Promise<string> {
  return toB64(new Uint8Array(await crypto.subtle.digest("SHA-256", enc.encode(body))));
}

// ACS HMAC request signing.
// stringToSign = METHOD + "\n" + pathAndQuery + "\n" + x-ms-date + ";" + host + ";" + x-ms-content-sha256
// Signature    = base64(HMAC-SHA256(base64decode(accessKey), stringToSign))
// [확인 필요] host in the string to sign: the docs sign the host WITHOUT scheme (e.g. "res.communication.azure.com").
// [확인 필요] x-ms-date format: the docs use the RFC 1123 / UTC string (Date.toUTCString()).
// [확인 필요] pathAndQuery must be exactly what is sent on the wire (including ?api-version=...).
export async function signAcs(opts: { method: string; pathAndQuery: string; date: string; host: string; contentHash: string; accessKey: string }): Promise<string> {
  const stringToSign = `${opts.method}\n${opts.pathAndQuery}\n${opts.date};${opts.host};${opts.contentHash}`;
  const key = await crypto.subtle.importKey("raw", fromB64(opts.accessKey), { name: "HMAC", hash: "SHA-256" }, false, ["sign"]);
  return toB64(new Uint8Array(await crypto.subtle.sign("HMAC", key, enc.encode(stringToSign))));
}

export async function sendMail(env: MailEnv, msg: MailMessage, opts: { now?: Date; fetchImpl?: typeof fetch } = {}): Promise<SendResult> {
  if (env.MAIL_ENABLED !== "1") return { ok: false, reason: "disabled" };
  if (!env.ACS_ENDPOINT || !env.ACS_ACCESS_KEY) return { ok: false, reason: "not_configured" };
  if (typeof msg.to !== "string" || CONTROL.test(msg.to) || !/^[^\s@]+@[^\s@]+$/.test(msg.to)) return { ok: false, reason: "invalid_recipient" };
  let base: URL;
  try {
    base = new URL(env.ACS_ENDPOINT);
  } catch {
    return { ok: false, reason: "not_configured" };
  }
  const pathAndQuery = `/emails:send?api-version=${API_VERSION}`;
  // [확인 필요] body shape (senderAddress / content.subject,plainText,html / recipients.to[].address) per the Email Send REST docs.
  const headers = safeHeaders(msg.headers);
  const body = JSON.stringify({
    senderAddress: clean(env.MAIL_SENDER || DEFAULT_SENDER),
    content: { subject: clean(msg.subject), plainText: msg.text, html: msg.html },
    recipients: { to: [{ address: msg.to }] },
    ...(headers ? { headers } : {}),
  });
  try {
    const date = (opts.now ?? new Date()).toUTCString();
    const contentHash = await sha256B64(body);
    const signature = await signAcs({ method: "POST", pathAndQuery, date, host: base.host, contentHash, accessKey: env.ACS_ACCESS_KEY });
    const res = await (opts.fetchImpl ?? fetch)(`${base.origin}${pathAndQuery}`, {
      method: "POST",
      headers: {
        "content-type": "application/json",
        "x-ms-date": date,
        "x-ms-content-sha256": contentHash,
        authorization: `HMAC-SHA256 SignedHeaders=x-ms-date;host;x-ms-content-sha256&Signature=${signature}`,
      },
      body,
    });
    if (res.status === 202) {
      // [확인 필요] operation id is in the "operation-id" response header and/or the JSON body "id".
      return { ok: true, operationId: res.headers.get("operation-id") ?? undefined };
    }
    if (res.status >= 400 && res.status < 500) return { ok: false, reason: "http_4xx" };
    if (res.status >= 500) return { ok: false, reason: "http_5xx" };
    return { ok: false, reason: "unexpected_status" };
  } catch {
    return { ok: false, reason: "network" };
  }
}
