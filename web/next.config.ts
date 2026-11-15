import path from "node:path";
import type { NextConfig } from "next";

/**
 * web/ is its own app inside the backend repo. Without an explicit root, Next.js sees
 * the repo's root lockfile, treats the repo as the workspace and pulls in backend files
 * such as the root proxy.ts (Supabase), which breaks this build locally and on Vercel.
 */
const appRoot = path.resolve(__dirname);

/**
 * The scan engine (Playwright worker, database, evidence files) runs outside Vercel.
 * Set BAROMI_API_ORIGIN to its public origin and every /api/v1 call is proxied there,
 * so the backend's session cookie stays first-party on this domain.
 */
const apiOrigin = process.env.BAROMI_API_ORIGIN?.replace(/\/$/, "");

const config: NextConfig = {
  turbopack: { root: appRoot },
  outputFileTracingRoot: appRoot,
  async rewrites() {
    if (!apiOrigin) return [];
    return [{ source: "/api/v1/:path*", destination: `${apiOrigin}/api/v1/:path*` }];
  },
  async headers() {
    return [{
      source: "/(.*)",
      headers: [
        { key: "X-Content-Type-Options", value: "nosniff" },
        { key: "X-Frame-Options", value: "DENY" },
        { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
        { key: "Permissions-Policy", value: "camera=(), microphone=(), geolocation=()" },
      ],
    }];
  },
};

export default config;
