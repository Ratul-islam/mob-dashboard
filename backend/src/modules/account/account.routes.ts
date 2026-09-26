import { FastifyInstance } from "fastify";
import { changePassword, getAccount, updateAccount } from "./account.controller.js";

// The signed-in user's own credentials. Mounted at /api/v1/account
export default async function accountRoutes(app: FastifyInstance) {
  app.addHook("preHandler", app.authenticate);

  app.get("/", getAccount);

  app.patch(
    "/",
    {
      schema: {
        body: {
          type: "object",
          additionalProperties: false,
          properties: {
            name: { type: "string", minLength: 1, maxLength: 100 },
            email: { type: "string", format: "email" },
            currentPassword: { type: "string", maxLength: 128 },
          },
        },
      },
    },
    async (request, reply) => updateAccount(request, reply, app),
  );

  app.post(
    "/password",
    {
      config: { rateLimit: { max: 10, timeWindow: "1 minute" } },
      schema: {
        body: {
          type: "object",
          required: ["currentPassword", "newPassword"],
          additionalProperties: false,
          properties: {
            currentPassword: { type: "string", minLength: 1, maxLength: 128 },
            newPassword: { type: "string", minLength: 8, maxLength: 128 },
          },
        },
      },
    },
    async (request, reply) => changePassword(request, reply, app),
  );
}
