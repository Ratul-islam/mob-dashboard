import type { NextConfig } from "next";

const rawBackendUrl = (process.env.BACKEND_URL ?? "http://localhost:8000").trim().replace(/\/+$/, "");
// Accept "my-api.vercel.app" as well as a full URL; rewrites need an absolute http(s) destination.
const backendUrl = /^https?:\/\//.test(rawBackendUrl) ? rawBackendUrl : `https://${rawBackendUrl}`;

const nextConfig: NextConfig = {
  reactCompiler: true,
  // The browser only ever talks to Next; API calls (and the httpOnly refresh cookie) are
  // proxied to the Fastify backend, so no CORS setup is needed.
  async rewrites() {
    return [{ source: "/api/v1/:path*", destination: `${backendUrl}/api/v1/:path*` }];
  },
};

export default nextConfig;
