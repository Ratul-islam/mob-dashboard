import Fastify from "fastify";
import AutoLoad from "@fastify/autoload";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { connectDB } from "./config/db.js";
import { getConfig } from "./config/config.js";
import { ensureRootUser } from "./modules/user/user.services.js";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

export async function buildApp() {
  const config = getConfig();
  const app = Fastify({
    logger: { level: config.isProduction ? "info" : "debug" },
    trustProxy: config.TRUST_PROXY,
  });

  await connectDB();
  await ensureRootUser({ name: config.ROOT_NAME, email: config.ROOT_EMAIL, password: config.ROOT_PASSWORD });

  await app.register(AutoLoad, {
    dir: path.join(__dirname, "plugins"),
    encapsulate: false,
  });

  await app.register(AutoLoad, {
    dir: path.join(__dirname, "modules"),
    matchFilter: (p) => /\.routes\.(ts|js)$/.test(p),
    options: { prefix: "/api/v1" },
  });

  if (!config.isProduction) {
    app.ready(() => console.log(app.printRoutes({ commonPrefix: false })));
  }

  return app;
}
