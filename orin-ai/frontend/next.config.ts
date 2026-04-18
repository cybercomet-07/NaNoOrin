import type { NextConfig } from "next";

/** Same-origin /api → FastAPI. Use BACKEND_URL in Docker (http://backend:8000); local dev defaults to host API. */
const backendBase = (process.env.BACKEND_URL ?? "http://127.0.0.1:8000").replace(/\/$/, "");

const nextConfig: NextConfig = {
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
