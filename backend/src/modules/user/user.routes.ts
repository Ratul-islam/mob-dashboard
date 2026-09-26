import { FastifyInstance } from "fastify";
import { create, list, remove, resetPassword, update } from "./user.controller.js";

const idParams = {
  type: "object",
  required: ["id"],
  properties: { id: { type: "string", pattern: "^[1-9][0-9]{0,9}$" } },
};

// Root-only user management. Mounted at /api/v1/user
export default async function userRoutes(app: FastifyInstance) {
  app.addHook("preHandler", app.authenticate);
  app.addHook("preHandler", app.requireRoot);

  app.get("/", list);

  app.post(
    "/",
    {
      schema: {
        body: {
          type: "object",
          required: ["name", "email"],
          additionalProperties: false,
          properties: {
            name: { type: "string", minLength: 1, maxLength: 100 },
            email: { type: "string", format: "email" },
            password: { type: "string", minLength: 8, maxLength: 128 },
          },
        },
      },
    },
    create,
  );

  app.patch(
    "/:id",
    {
      schema: {
        params: idParams,
        body: {
          type: "object",
          additionalProperties: false,
          properties: {
            name: { type: "string", minLength: 1, maxLength: 100 },
            email: { type: "string", format: "email" },
            isActive: { type: "boolean" },
          },
        },
      },
    },
    update,
  );

  app.post(
    "/:id/reset-password",
    {
      schema: {
        params: idParams,
        body: {
          type: ["object", "null"],
          additionalProperties: false,
          properties: { password: { type: "string", minLength: 8, maxLength: 128 } },
        },
      },
    },
    resetPassword,
  );

  app.delete("/:id", { schema: { params: idParams } }, remove);
}
