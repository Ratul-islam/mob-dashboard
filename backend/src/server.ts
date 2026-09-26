import { buildApp } from "./application.js";
import { getConfig } from "./config/config.js";

const app = await buildApp();
const { PORT } = getConfig();

try {
  await app.listen({ port: PORT, host: "0.0.0.0" });
} catch (err) {
  app.log.error(err);
  process.exit(1);
}

for (const signal of ["SIGINT", "SIGTERM"] as const) {
  process.once(signal, async () => {
    await app.close();
    process.exit(0);
  });
}
