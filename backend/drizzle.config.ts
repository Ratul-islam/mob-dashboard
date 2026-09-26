import "dotenv/config";
import { defineConfig } from "drizzle-kit";

const env = process.env;

export default defineConfig({
  dialect: "mysql",
  schema: "./src/modules/**/*.model.ts",
  out: "./drizzle",
  dbCredentials: {
    host: env.DB_HOST ?? "localhost",
    port: Number(env.DB_PORT ?? 3306),
    user: env.DB_USER ?? "root",
    password: env.DB_PASSWORD,
    database: env.DB_NAME ?? "anura_dashboard",
  },
});
