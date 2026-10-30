import "server-only";
import { getCloudflareContext } from "@opennextjs/cloudflare";

// Unsubscribe token = base64url(email) + "." + base64url(HMAC-SHA256(UNSUB_SECRET, email)). Stateless: the link works
// without storing anything extra, and cannot be forged without the server secret.
const enc = new TextEncoder();

// Secrets reach the Worker as bindings and process.env does not always mirror them, so the binding is checked first.
function secretValue(): string | undefined {
  try {
    const v = (getCloudflareContext().env as Record<string, unknown>)["UNSUB_SECRET"];
    if (typeof v === "string" && v) return v;
  } catch {
    /* not inside a Worker request */
  }
  return process["env"]["UNSUB_SECRET"];
}

function b64u(bytes: Uint8Array): string {
  let s = "";
  for (const b of bytes) s += String.fromCharCode(b);
  return btoa(s).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
}
function fromB64u(s: string): Uint8Array<ArrayBuffer> {
  const bin = atob(s.replace(/-/g, "+").replace(/_/g, "/"));
  const out = new Uint8Array(new ArrayBuffer(bin.length));
  for (let i = 0; i < bin.length; i++) out[i] = bin.charCodeAt(i);
  return out;
}

async function hmac(email: string, secret: string): Promise<Uint8Array> {
  const key = await crypto.subtle.importKey("raw", enc.encode(secret), { name: "HMAC", hash: "SHA-256" }, false, ["sign"]);
  return new Uint8Array(await crypto.subtle.sign("HMAC", key, enc.encode(email)));
}

export async function makeUnsubToken(email: string): Promise<string> {
  const secret = secretValue();
  if (!secret) throw new Error("UNSUB_SECRET is not set");
  const e = email.trim().toLowerCase();
  return `${b64u(enc.encode(e))}.${b64u(await hmac(e, secret))}`;
}

// Returns the lower-cased email when the token is authentic, otherwise null.
export async function verifyUnsubToken(token: string): Promise<string | null> {
  const secret = secretValue();
  if (!secret) return null;
  const [a, b, extra] = token.split(".");
  if (!a || !b || extra !== undefined) return null;
  try {
    const email = new TextDecoder().decode(fromB64u(a));
    const key = await crypto.subtle.importKey("raw", enc.encode(secret), { name: "HMAC", hash: "SHA-256" }, false, ["verify"]);
    const ok = await crypto.subtle.verify("HMAC", key, fromB64u(b), enc.encode(email)); // constant-time compare
    return ok ? email : null;
  } catch {
    return null;
  }
}
