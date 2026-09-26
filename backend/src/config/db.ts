import dns from "node:dns";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import mysql from "mysql2/promise";
import { drizzle } from "drizzle-orm/mysql2";
import { migrate } from "drizzle-orm/mysql2/migrator";
import { getConfig } from "./config.js";

// Some hosts publish an IPv6 address that isn't reachable from every network; try IPv4 first.
dns.setDefaultResultOrder("ipv4first");

const { db: dbConfig, DB_POOL_SIZE } = getConfig();

// All dates are stored and read as UTC (Anura reports in UTC).
const pool = mysql.createPool({
  ...dbConfig,
  connectTimeout: 20_000,
  timezone: "Z",
  connectionLimit: DB_POOL_SIZE,
  dateStrings: false,
});

export const db = drizzle({ client: pool });

/**
 * Creates the database when the account is allowed to (local setups). Hosted databases usually
 * exist already and forbid CREATE DATABASE, so a failure here is not fatal.
 */
async function ensureDatabase() {
  const { database, ...server } = dbConfig;
  if (!database) return;
  let conn: mysql.Connection | undefined;
  try {
    conn = await mysql.createConnection({ ...server, connectTimeout: 20_000 });
    await conn.query(`CREATE DATABASE IF NOT EXISTS \`${database.replaceAll("`", "")}\` CHARACTER SET utf8mb4`);
  } catch {
    /* no permission or no server-level access: use the existing database */
  } finally {
    await conn?.end().catch(() => {});
  }
}

/** Finds /drizzle next to the source (dev, dist, Vercel bundle) or in the working directory. */
function migrationsFolder() {
  const candidates = [
    fileURLToPath(new URL("../../drizzle", import.meta.url)),
    path.resolve(process.cwd(), "drizzle"),
  ];
  return candidates.find((dir) => fs.existsSync(path.join(dir, "meta", "_journal.json"))) ?? candidates[0];
}

/** Makes sure the database exists, then applies pending migrations from /drizzle. */
export async function connectDB() {
  try {
    await ensureDatabase();

    await migrate(db, { migrationsFolder: migrationsFolder() });
    console.log(`MySQL connected (${dbConfig.user}@${dbConfig.host}:${dbConfig.port}/${dbConfig.database}) and migrated`);
  } catch (err) {
    console.error("MySQL connection failed:", err);
    process.exit(1);
  }
}

export async function closeDB() {
  await pool.end();
}
