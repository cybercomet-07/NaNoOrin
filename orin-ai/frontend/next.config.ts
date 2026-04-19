import type { NextConfig } from "next";

/**
 * Browser calls same-origin `/api/*`; Next.js proxies to FastAPI.
 * - Local dev: default http://127.0.0.1:8000 (backend on host)
 * - Docker: set BACKEND_URL=http://backend:8000 (see Dockerfile ARG + compose)
 */
const backendBase = (process.env.BACKEND_URL || "http://127.0.0.1:8000").replace(
  /\/$/,
  "",
);

const nextConfig: NextConfig = {
  // Hide the small "N" dev-mode route indicator in the bottom-left corner.
  devIndicators: false,
  async rewrites() {
    return [
      {
        source: "/api/:path*",
        destination: `${backendBase}/:path*`,
      },
    ];
  },
};

export default nextConfig;
