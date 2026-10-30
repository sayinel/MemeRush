// Unsubscribe link target: /api/unsubscribe?token=... Deletes the subscriber row immediately (privacy draft:
// "unsubscribe = delete right away"). Valid token for an already-deleted address is still a success.
// Never log the email address (personal data).
import { promises as fs } from "node:fs";
import path from "node:path";
import { hasRemoteDb, supabaseAdmin } from "@/lib/supabase";
import { verifyUnsubToken } from "@/lib/unsub";

const FILE = process.env.SUBSCRIBERS_FILE || path.join(process.cwd(), ".data", "subscribers.jsonl");

async function removeFromFile(email: string) {
  const text = await fs.readFile(FILE, "utf8").catch(() => "");
  const keep = text.split("\n").filter((line) => {
    if (!line) return false;
    try {
      return JSON.parse(line).email !== email;
    } catch {
      return true;
    }
  });
  await fs.writeFile(FILE, keep.length ? keep.join("\n") + "\n" : "");
}

function page(status: number, title: string, body: string) {
  const html = `<!doctype html><html lang="en"><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>${title}</title><body style="font-family:system-ui,sans-serif;max-width:32rem;margin:15vh auto;padding:0 1rem;text-align:center"><h1>${title}</h1><p>${body}</p></body></html>`;
  return new Response(html, { status, headers: { "content-type": "text/html; charset=utf-8", "cache-control": "no-store" } });
}

export async function GET(request: Request) {
  const token = new URL(request.url).searchParams.get("token") ?? "";
  const email = await verifyUnsubToken(token);
  if (!email) return page(400, "Invalid link", "This unsubscribe link is not valid.");
  try {
    if (hasRemoteDb()) {
      const { error } = await supabaseAdmin().from("email_subscribers").delete().eq("email", email);
      if (error) return page(500, "Something went wrong", "Please try again later.");
    } else {
      await removeFromFile(email);
    }
  } catch {
    return page(500, "Something went wrong", "Please try again later.");
  }
  return page(200, "Unsubscribed", "Your email address has been deleted from our list.");
}
