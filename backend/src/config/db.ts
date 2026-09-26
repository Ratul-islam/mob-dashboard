import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import mysql from "mysql2/promise";
import { drizzle } from "drizzle-orm/mysql2";
import { migrate } from "drizzle-orm/mysql2/migrator";
import { getConfig } from "./config.js";

// All dates are stored and read as UTC (Anura reports in UTC).
const pool = mysql.createPool({
  uri: getConfig().DATABASE_URL,
  timezone: "Z",
  connectionLimit: getConfig().DB_POOL_SIZE,
  dateStrings: false,
});

export const db = drizzle({ client: pool });

/**
 * Creates the database when the account is allowed to (local setups). Hosted databases usually
 * exist already and forbid CREATE DATABASE, so a failure here is not fatal.
 */
async function ensureDatabase() {
  const url = new URL(getConfig().DATABASE_URL);
  const database = decodeURIComponent(url.pathname.replace(/^\//, ""));
  if (!database) return;
  url.pathname = "/";
  let conn: mysql.Connection | undefined;
  try {
    conn = await mysql.createConnection({ uri: url.toString() });
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
    console.log("Testing MySQL connection...");

    const [rows] = await pool.query("SELECT 1 AS ok");
    console.log("MySQL SELECT test:", rows);

    await pool.query(`
      CREATE TABLE IF NOT EXISTS __drizzle_test (
        id INT NOT NULL AUTO_INCREMENT,
        test_value TEXT NOT NULL,
        PRIMARY KEY (id)
      )
    `);

    console.log("MySQL CREATE TABLE test: OK");

    await pool.query("DROP TABLE IF EXISTS __drizzle_test");

    console.log("MySQL connection and permissions are OK");

    await migrate(db, {
      migrationsFolder: migrationsFolder(),
    });

    console.log("MySQL connected and migrated");
  } catch (err: any) {
    console.error("========== MYSQL DEBUG ==========");
    console.error("name:", err?.name);
    console.error("code:", err?.code);
    console.error("errno:", err?.errno);
    console.error("sqlState:", err?.sqlState);
    console.error("sqlMessage:", err?.sqlMessage);
    console.error("message:", err?.message);
    console.error("stack:", err?.stack);
    console.error("=================================");
    process.exit(1);
  }
}

export async function closeDB() {
  await pool.end();
}
