import { defineCloudflareConfig } from "@opennextjs/cloudflare";

// No incremental cache / queue: all pages are rendered per request or static; data lives in Supabase.
export default defineCloudflareConfig();
