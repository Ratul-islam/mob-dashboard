import fp from "fastify-plugin";
import helmet from "@fastify/helmet";
import cors from "@fastify/cors";
import cookie from "@fastify/cookie";
import rateLimit from "@fastify/rate-limit";
import { getConfig } from "../config/config.js";
import { getIP } from "../utils/getIp.js";

export default fp(async (app) => {
  const config = getConfig();

  await app.register(helmet);
  await app.register(cookie);
  await app.register(cors, {
    origin: config.CORS_ORIGIN.split(",").map((o) => o.trim()).filter(Boolean),
    credentials: true,
  });
  // Opt-in per route through `config.rateLimit`.
  await app.register(rateLimit, {
    global: false,
    keyGenerator: (request) => getIP(request),
  });
});
