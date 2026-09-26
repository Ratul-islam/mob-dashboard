import path from "node:path";
import mysql from "mysql2/promise";
import { drizzle } from "drizzle-orm/mysql2";
import { migrate } from "drizzle-orm/mysql2/migrator";
import { getConfig } from "./config.js";

// All dates are stored and read as UTC (Anura reports in UTC).
const pool = mysql.createPool({
  uri: getConfig().DATABASE_URL,
  timezone: "Z",
  connectionLimit: 10,
  dateStrings: false,
});

export const db = drizzle({ client: pool });

/** Creates the database if it doesn't exist yet, then applies pending migrations from /drizzle. */
export async function connectDB() {
  try {
    const url = new URL(getConfig().DATABASE_URL);
    const database = decodeURIComponent(url.pathname.replace(/^\//, ""));
    if (database) {
      url.pathname = "/";
      const admin = await mysql.createConnection({ uri: url.toString() });
      await admin.query(
        `CREATE DATABASE IF NOT EXISTS \`${database.replaceAll("`", "")}\` CHARACTER SET utf8mb4 COLLATE utf8mb4_0900_ai_ci`,
      );
      await admin.end();
    }

    await migrate(db, { migrationsFolder: path.resolve(process.cwd(), "drizzle") });
    console.log("MySQL connected and migrated");
  } catch (err) {
    console.error("MySQL connection failed:", err);
    process.exit(1);
  }
}

export async function closeDB() {
  await pool.end();
}
