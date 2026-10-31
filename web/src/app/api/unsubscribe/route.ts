// Unsubscribe link target: /api/unsubscribe?token=...  Never log the address or the token.
//   GET  -> confirmation page with a button only. Mail security scanners pre-open links with GET, so GET never deletes.
//   POST -> deletes the row at once (privacy draft: "unsubscribe = delete right away") and keeps a keyed hash of the
//           address on the suppression list so it is never mailed again. Accepts the button form (token in the body)
//           and RFC 8058 one-click (POST to the List-Unsubscribe URL, token in the query, body
//           "List-Unsubscribe=One-Click"). A valid token for an already-deleted row is still a success.
// Tokens carry a subscription id + expiry + key version, never the address (see lib/sub_token.ts).
import { unsubscribe } from "@/lib/sub_flow";
import { flowDeps, page, tokenFrom } from "@/lib/subscriptions";
import { verifyToken } from "@/lib/sub_token";
import { keyRing } from "@/lib/unsub";

const INVALID = () => page(400, "Invalid link", "This unsubscribe link is not valid.");
const EXPIRED = () => page(410, "Link expired", "This unsubscribe link has expired. Use the link in a newer mail.");
const ERROR = () => page(500, "Something went wrong", "Please try again later.");

export async function GET(request: Request) {
  const token = new URL(request.url).searchParams.get("token") ?? "";
  const v = await verifyToken(keyRing(), token, "u", Math.floor(Date.now() / 1000));
  if (!v) return INVALID();
  if ("expired" in v) return EXPIRED();
  return page(200, "Unsubscribe", "Press the button to stop MemeRush mail and delete your address from our list.", {
    action: "/api/unsubscribe",
    token,
    button: "Unsubscribe",
  });
}

export async function POST(request: Request) {
  const token = await tokenFrom(request);
  const deps = flowDeps(new URL(request.url).host);
  if (!deps) return ERROR(); // no D1 binding: no mail was ever sent from this deployment
  try {
    const r = await unsubscribe(deps, token);
    if (r === "invalid") return INVALID();
    if (r === "expired") return EXPIRED();
    return page(200, "Unsubscribed", "Your email address has been deleted from our list. We will not mail you again.");
  } catch {
    return ERROR();
  }
}
