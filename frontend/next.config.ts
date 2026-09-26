import type { NextConfig } from "next";

const backendUrl = (process.env.BACKEND_URL ?? "http://localhost:8000").replace(/\/+$/, "");

const nextConfig: NextConfig = {
  reactCompiler: true,
  // The browser only ever talks to Next; API calls (and the httpOnly refresh cookie) are
  // proxied to the Fastify backend, so no CORS setup is needed.
  async rewrites() {
    return [{ source: "/api/v1/:path*", destination: `${backendUrl}/api/v1/:path*` }];
  },
};

export default nextConfig;
