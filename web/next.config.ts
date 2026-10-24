import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // ffmpeg-static resolves its binary by path at runtime; keep it unbundled and trace the binary + fonts.
  serverExternalPackages: ["ffmpeg-static"],
  outputFileTracingIncludes: {
    "/api/**": ["./node_modules/ffmpeg-static/ffmpeg", "./assets/fonts/**/*"],
    // lib/challenge.ts reads day files from disk at runtime.
    "/**": ["./content/challenges/*.json"],
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
