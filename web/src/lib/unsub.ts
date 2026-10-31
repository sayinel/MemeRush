import "server-only";
import { getCloudflareContext } from "@opennextjs/cloudflare";
import type { KeyRing } from "@/lib/sub_token";

// Signing keys for subscription links (confirm / unsubscribe) and keyed hashes, see sub_token.ts.
//   UNSUB_SECRET          key version 1 (secret)
//   UNSUB_SECRET_V2..V9   later versions (secrets), added when the key is rotated
//   UNSUB_KEY_VERSION     version used for NEW links (plain var, default "1"); old versions still verify while set
// Secrets reach the Worker as bindings and process.env does not always mirror them, so the binding is checked first.
function val(name: string): string | undefined {
  try {
    const v = (getCloudflareContext().env as Record<string, unknown>)[name];
    if (typeof v === "string" && v) return v;
  } catch {
    /* not inside a Worker request */
  }
  const p = process["env"][name];
  return p ? p : undefined;
}

export function keyRing(): KeyRing | null {
  const keys: Record<string, string> = {};
  const v1 = val("UNSUB_SECRET");
  if (v1) keys["1"] = v1;
  for (let n = 2; n <= 9; n++) {
    const s = val(`UNSUB_SECRET_V${n}`);
    if (s) keys[String(n)] = s;
  }
  if (!Object.keys(keys).length) return null;
  const want = val("UNSUB_KEY_VERSION") ?? "1";
  const current = keys[want] ? want : Object.keys(keys).sort((a, b) => Number(b) - Number(a))[0];
  return { current, keys };
}
