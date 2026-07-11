import type { NextConfig } from "next";

// Backend origin (Python/FastAPI). In dev: localhost:8000. In prod: the deployed
// API URL. Browser calls go through the /bff rewrite so the same-origin session
// cookie flows to the backend; server components call the backend directly and
// forward the cookie manually (lib/server-data.ts).
const BACKEND =
  process.env.BACKEND_ORIGIN?.replace(/\/$/, "") || "http://localhost:8000";

const nextConfig: NextConfig = {
  async rewrites() {
    return [
      { source: "/bff/:path*", destination: `${BACKEND}/:path*` },
      { source: "/api-docs", destination: `${BACKEND}/api-docs` },
      { source: "/openapi.json", destination: `${BACKEND}/openapi.json` },
    ];
  },
};

export default nextConfig;
