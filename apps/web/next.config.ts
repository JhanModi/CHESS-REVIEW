import { config as loadEnv } from "dotenv";
import { join } from "node:path";
import type { NextConfig } from "next";

// The monorepo keeps one .env at the repo root; Next only auto-loads from the
// app directory. `override: false` keeps real environment variables winning.
loadEnv({ path: join(__dirname, "..", "..", ".env"), override: false, quiet: true });

const nextConfig: NextConfig = {
  // Cross-origin isolation for SharedArrayBuffer (multithreaded Stockfish).
  // COEP `credentialless` instead of `require-corp` so Clerk's cross-origin
  // resources keep working; Safari degrades to the single-threaded engine
  // via a runtime `crossOriginIsolated` check (ADR 005).
  async headers() {
    return [
      {
        source: "/(.*)",
        headers: [
          { key: "Cross-Origin-Opener-Policy", value: "same-origin" },
          { key: "Cross-Origin-Embedder-Policy", value: "credentialless" },
        ],
      },
      {
        // Engine artifacts and piece sets are immutable — cache hard.
        source: "/:prefix(stockfish|pieces)/:path*",
        headers: [{ key: "Cache-Control", value: "public, max-age=31536000, immutable" }],
      },
    ];
  },
};

export default nextConfig;
