import fp from "fastify-plugin";
import fastifyJwt from "@fastify/jwt";
import { FastifyReply, FastifyRequest } from "fastify";
import { getConfig } from "../config/config.js";
import { getUser } from "../modules/user/user.services.js";
import { sendError } from "../utils/responses.js";

export default fp(async (app) => {
  const config = getConfig();

  await app.register(fastifyJwt, {
    secret: config.JWT_ACCESS_SECRET,
    namespace: "access",
    sign: { expiresIn: "15m" },
  });
  await app.register(fastifyJwt, {
    secret: config.JWT_REFRESH_SECRET,
    namespace: "refresh",
    sign: { expiresIn: "7d" },
  });
  await app.register(fastifyJwt, {
    secret: config.JWT_PASS_RESET_SECRET,
    namespace: "reset",
    sign: { expiresIn: "10m" },
  });

  app.decorateRequest("authUser", null);

  app.decorate("authenticate", async (request: FastifyRequest, reply: FastifyReply) => {
    const header = request.headers.authorization;
    const token = header?.startsWith("Bearer ") ? header.slice(7) : null;
    if (!token) return sendError(reply, { statusCode: 401, message: "Unauthorized" });

    let payload: { sub: string; iat: number };
    try {
      payload = app.jwt.access.verify(token);
    } catch {
      return sendError(reply, { statusCode: 401, message: "Unauthorized" });
    }

    const user = await getUser({ id: payload.sub });
    if (!user || !user.isActive) {
      return sendError(reply, { statusCode: 401, message: "Unauthorized" });
    }
    // Tokens issued before the last credential change are no longer valid.
    if (user.credentialsChangedAt && payload.iat * 1000 < user.credentialsChangedAt.getTime()) {
      return sendError(reply, { statusCode: 401, message: "Session expired" });
    }

    // Accounts on a temporary password can only reach their account settings until they change it.
    const route = request.routeOptions.url ?? "";
    if (user.mustChangePassword && !route.startsWith("/api/v1/account") && !route.startsWith("/api/v1/auth")) {
      return sendError(reply, { statusCode: 403, message: "Change your temporary password to continue" });
    }

    request.authUser = { id: String(user.id), role: user.role, email: user.email, name: user.name };
  });

  app.decorate("requireRoot", async (request: FastifyRequest, reply: FastifyReply) => {
    if (request.authUser?.role !== "root") {
      return sendError(reply, { statusCode: 403, message: "Only the root user can do this" });
    }
  });
});
