// Signed link tokens for the subscription flow (confirm and unsubscribe). Pure module (no imports, Web Crypto only).
//
// Format: v<keyVersion>.<kind>.<subscriptionId>.<expiresAtUnixSec>.<base64url HMAC-SHA256>
//   - no email address inside (a URL in a log, browser history or forwarded mail reveals only a random row id)
//   - expiry is signed, so it cannot be extended
//   - the key version lets a new secret be introduced while links signed with the old one still verify
// The signature covers "v<ver>.<kind>.<id>.<exp>", so a confirm token can never be used as an unsubscribe token.

export type TokenKind = "c" | "u"; // c = confirm subscription, u = unsubscribe
export type KeyRing = { current: string; keys: Record<string, string> }; // version -> secret

const enc = new TextEncoder();
const ID = /^[A-Za-z0-9-]{1,64}$/;
const VER = /^[0-9]{1,3}$/;

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

async function hmacKey(secret: string, usage: "sign" | "verify") {
  return crypto.subtle.importKey("raw", enc.encode(secret), { name: "HMAC", hash: "SHA-256" }, false, [usage]);
}

export async function makeToken(ring: KeyRing, kind: TokenKind, subId: string, expSec: number): Promise<string> {
  const ver = ring.current;
  const secret = ring.keys[ver];
  if (!secret || !VER.test(ver)) throw new Error("signing key is not set");
  if (!ID.test(subId)) throw new Error("bad subscription id");
  const payload = `v${ver}.${kind}.${subId}.${Math.floor(expSec)}`;
  const sig = new Uint8Array(await crypto.subtle.sign("HMAC", await hmacKey(secret, "sign"), enc.encode(payload)));
  return `${payload}.${b64u(sig)}`;
}

// Returns the subscription id when the token is authentic, of the expected kind and not expired; otherwise null.
// "expired" is reported separately so the page can say so (only after the signature checked out).
export async function verifyToken(
  ring: KeyRing | null,
  token: string,
  kind: TokenKind,
  nowSec: number,
): Promise<{ subId: string; exp: number } | { expired: true } | null> {
  if (!ring || typeof token !== "string" || token.length > 300) return null;
  const parts = token.split(".");
  if (parts.length !== 5) return null;
  const [v, k, subId, expStr, sig] = parts;
  if (!v.startsWith("v") || !VER.test(v.slice(1)) || k !== kind || !ID.test(subId) || !/^[0-9]{1,12}$/.test(expStr)) return null;
  const secret = ring.keys[v.slice(1)];
  if (!secret) return null;
  try {
    const payload = `${v}.${k}.${subId}.${expStr}`;
    // crypto.subtle.verify compares in constant time.
    const ok = await crypto.subtle.verify("HMAC", await hmacKey(secret, "verify"), fromB64u(sig), enc.encode(payload));
    if (!ok) return null;
  } catch {
    return null;
  }
  const exp = Number(expStr);
  if (exp < nowSec) return { expired: true };
  return { subId, exp };
}

// Keyed one-way hash (HMAC) for values we must compare later but must not keep in clear: suppressed addresses,
// rate-limit keys for IP and address. Without a key ring it falls back to plain SHA-256 (still not the clear value).
export async function keyedHash(secret: string | undefined, label: string, value: string): Promise<string> {
  const data = enc.encode(`${label}:${value}`);
  if (!secret) return b64u(new Uint8Array(await crypto.subtle.digest("SHA-256", data)));
  return b64u(new Uint8Array(await crypto.subtle.sign("HMAC", await hmacKey(secret, "sign"), data)));
}

// Hashes of one value under every key version ("<ver>:<hash>"), so a suppression stored under an old key still matches
// after the key is rotated.
export async function hashesForAllKeys(ring: KeyRing | null, label: string, value: string): Promise<string[]> {
  if (!ring || !Object.keys(ring.keys).length) return [`0:${await keyedHash(undefined, label, value)}`];
  const out: string[] = [];
  for (const [ver, secret] of Object.entries(ring.keys)) out.push(`${ver}:${await keyedHash(secret, label, value)}`);
  return out;
}
export async function hashForCurrentKey(ring: KeyRing | null, label: string, value: string): Promise<string> {
  if (!ring || !ring.keys[ring.current]) return `0:${await keyedHash(undefined, label, value)}`;
  return `${ring.current}:${await keyedHash(ring.keys[ring.current], label, value)}`;
}
