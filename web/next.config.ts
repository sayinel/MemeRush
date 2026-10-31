import type { NextConfig } from "next";

// Baseline security headers for every page and API response served by the worker (static files in .open-next/assets
// are served by the ASSETS binding directly and get the same set from public/_headers).
// frame-ancestors allows our own site family only (superagents.run may embed the game); everything else cannot frame it.
export const SECURITY_HEADERS = [
  { key: "X-Content-Type-Options", value: "nosniff" },
  { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
  { key: "Content-Security-Policy", value: "frame-ancestors 'self' https://superagents.run https://*.superagents.run" },
];

const nextConfig: NextConfig = {
  async headers() {
    return [{ source: "/:path*", headers: SECURITY_HEADERS }];
  },
  // ffmpeg-static resolves its binary by path at runtime; keep it unbundled and trace the binary + fonts.
  serverExternalPackages: ["ffmpeg-static"],
  outputFileTracingIncludes: {
    "/api/**": ["./node_modules/ffmpeg-static/ffmpeg", "./assets/fonts/**/*"],
    // lib/challenge.ts reads day files from disk at runtime.
    "/**": ["./content/challenges/*.json"],
    // The OG card embeds the worker sprite; public/ is served by the CDN and isn't traced by default.
    "/api/og/**": ["./public/game/worker_smug.png"],
    // The result video composes the game sprites and the bg_win/bg_lose backgrounds into each scene.
    "/api/videos": ["./public/game/**/*", "./assets/video/**/*"],
  },
  turbopack: {
    rules: {
      "*.css": {
        loaders: ["@tailwindcss/turbopack"],
        as: "*.css",
      },
    },
  },
};

export default nextConfig;
