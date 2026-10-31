// Double opt-in confirm link: /api/subscribe/confirm?token=...  Never log the address or the token.
//   GET  -> page with a confirm button only (link scanners pre-open mail links; they must not confirm by themselves)
//   POST -> pending row becomes active, then the welcome mail (with one-click unsubscribe headers) goes out
import { confirm } from "@/lib/sub_flow";
import { flowDeps, page, tokenFrom } from "@/lib/subscriptions";
import { verifyToken } from "@/lib/sub_token";
import { keyRing } from "@/lib/unsub";

const INVALID = () => page(400, "Invalid link", "This confirmation link is not valid.");
const EXPIRED = () => page(410, "Link expired", "This confirmation link has expired. Please subscribe again.");

export async function GET(request: Request) {
  const token = new URL(request.url).searchParams.get("token") ?? "";
  const v = await verifyToken(keyRing(), token, "c", Math.floor(Date.now() / 1000));
  if (!v) return INVALID();
  if ("expired" in v) return EXPIRED();
  return page(200, "Get MemeRush news", "Press the button to also get mail about new games. Today's game link works either way.", {
    action: "/api/subscribe/confirm",
    token,
    button: "Also get future news",
  });
}

export async function POST(request: Request) {
  const token = await tokenFrom(request);
  const deps = flowDeps(new URL(request.url).host);
  if (!deps) return page(500, "Something went wrong", "Please try again later.");
  try {
    const r = await confirm(deps, token);
    if (r === "invalid") return INVALID();
    if (r === "expired" || r === "gone") return EXPIRED();
    return page(200, "Subscribed", "Thanks. We will mail you when a new game is out.");
  } catch {
    return page(500, "Something went wrong", "Please try again later.");
  }
}
