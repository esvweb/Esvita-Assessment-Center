import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  experimental: { serverActions: { bodySizeLimit: "8mb" } },
  /**
   * Verification builds write somewhere else.
   *
   * `next build` and `next dev` share `.next` by default, so building while the
   * dev server is running replaces the chunks the open browser tab is still
   * asking for — which surfaces as a ChunkLoadError in the middle of someone's
   * work. `npm run verify` sets NEXT_DIST_DIR so the two never collide.
   */
  distDir: process.env.NEXT_DIST_DIR || ".next",
};

export default nextConfig;
