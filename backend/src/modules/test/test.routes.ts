import { FastifyInstance } from "fastify";
import { sql } from "drizzle-orm";
import { db } from "../../config/db.js";

// Health check: GET /api/v1/test
const testFunc = async (app: FastifyInstance) => {
  app.get("/", async (_request, reply) => {
    const dbUp = await db.execute(sql`select 1`).then(() => true, () => false);
    reply.code(dbUp ? 200 : 503).send({ status: dbUp ? "ok" : "degraded", db: dbUp ? "up" : "down" });
  });
};

export default testFunc;
