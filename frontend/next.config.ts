import path from "node:path";
import type { NextConfig } from "next";

const rawBackendUrl = (process.env.BACKEND_URL ?? "http://localhost:8000").trim().replace(/\/+$/, "");
// Accept "my-api.vercel.app" as well as a full URL; rewrites need an absolute http(s) destination.
const backendUrl = /^https?:\/\//.test(rawBackendUrl) ? rawBackendUrl : `https://${rawBackendUrl}`;

// This app lives in frontend/ of a repo that also has backend/ (and its own lockfile), so pin the
// project root instead of letting Next guess the repository root.
const projectRoot = path.resolve(__dirname);

// Shared hosts (e.g. Hostinger) cap processes and memory far below the CPU count they report, so
// builds spawn fewer workers. Override with NEXT_BUILD_CPUS if the host allows more.
const buildCpus = Number(process.env.NEXT_BUILD_CPUS) || 2;

const nextConfig: NextConfig = {
  reactCompiler: true,
  turbopack: { root: projectRoot },
  outputFileTracingRoot: projectRoot,
  experimental: {
    cpus: buildCpus,
    memoryBasedWorkersCount: true,
    webpackMemoryOptimizations: true,
  },
  // The browser only ever talks to Next; API calls (and the httpOnly refresh cookie) are
  // proxied to the Fastify backend, so no CORS setup is needed.
  async rewrites() {
    return [{ source: "/api/v1/:path*", destination: `${backendUrl}/api/v1/:path*` }];
  },
};

export default nextConfig;
