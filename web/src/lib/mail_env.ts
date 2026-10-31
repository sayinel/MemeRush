import "server-only";
import { getCloudflareContext } from "@opennextjs/cloudflare";
import type { MailEnv } from "@/lib/mailer";

// Same pattern as unsub.ts: Cloudflare binding first, then the process environment (next dev on the PC).
function val(name: string): string | undefined {
  try {
    const v = (getCloudflareContext().env as Record<string, unknown>)[name];
    if (typeof v === "string" && v) return v;
  } catch {
    /* not inside a Worker request */
  }
  return process["env"][name];
}

export function mailEnv(): MailEnv {
  return { ACS_ENDPOINT: val("ACS_ENDPOINT"), ACS_ACCESS_KEY: val("ACS_ACCESS_KEY"), MAIL_SENDER: val("MAIL_SENDER"), MAIL_ENABLED: val("MAIL_ENABLED") };
}
export const siteHostEnv = () => val("SITE_HOST");

export const newsletterKeyEnv = () => val("NEWSLETTER_SEND_KEY");
