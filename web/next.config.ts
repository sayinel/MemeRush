import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // ffmpeg-static resolves its binary by path at runtime; keep it unbundled and trace the binary + fonts.
  serverExternalPackages: ["ffmpeg-static"],
  outputFileTracingIncludes: {
    "/api/**": ["./node_modules/ffmpeg-static/ffmpeg", "./assets/fonts/**/*"],
    // lib/challenge.ts reads day files from disk at runtime.
    "/**": ["./content/challenges/*.json"],
    // The OG card embeds the worker sprite; public/ is served by the CDN and isn't traced by default.
    "/api/og/**": ["./public/game/worker_smug.png"],
    // The result video composes the game sprites (and bg_win/bg_lose once they exist) into each scene.
    "/api/videos": ["./public/game/**/*"],
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
