import { FastifyInstance, FastifyReply, FastifyRequest } from "fastify";
import fp from "fastify-plugin";
import { sendError } from "../utils/responses.js";

export default fp(async function errorHandler(app: FastifyInstance) {
  app.setErrorHandler((error: any, request: FastifyRequest, reply: FastifyReply) => {
    if (error.code === "FST_ERR_VALIDATION" || error.validation) {
      return sendError(reply, {
        statusCode: 400,
        message: "Validation error",
        errors: {
          message: error.message,
          details: error.validation ?? [],
        },
      });
    }

    // MySQL duplicate key (e.g. unique email)
    if (error.code === "ER_DUP_ENTRY" || error.cause?.code === "ER_DUP_ENTRY") {
      return sendError(reply, { statusCode: 409, message: "A record with this value already exists" });
    }

    const statusCode = error.statusCode ?? 500;
    if (statusCode >= 500) request.log.error(error);

    return sendError(reply, {
      statusCode,
      message: statusCode >= 500 && !error.expose ? "Internal Server Error" : error.message,
    });
  });
});
