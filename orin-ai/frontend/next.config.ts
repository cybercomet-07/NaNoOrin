import type { NextConfig } from "next";

<<<<<<< HEAD
=======
/**
 * Browser calls same-origin `/api/*`; Next.js proxies to FastAPI.
 * - Local dev: default http://127.0.0.1:8000 (backend on host)
 * - Docker: set BACKEND_URL=http://backend:8000 (see Dockerfile ARG + compose)
 */
const backendBase = (process.env.BACKEND_URL || "http://127.0.0.1:8000").replace(
  /\/$/,
  "",
);

>>>>>>> origin/main
const nextConfig: NextConfig = {
  async rewrites() {
    return [
      {
        source: "/api/:path*",
<<<<<<< HEAD
        destination: "http://localhost:8000/:path*",  // Proxy to FastAPI
      },
    ]
=======
        destination: `${backendBase}/:path*`,
      },
    ];
>>>>>>> origin/main
  },
};

export default nextConfig;
