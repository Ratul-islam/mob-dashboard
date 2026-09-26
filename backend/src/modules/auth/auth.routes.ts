import { FastifyInstance } from "fastify";
import {
  login,
  logout,
  me,
  renewToken,
  requestPasswordReset,
  resetPassword,
  verifyPasswordResetOtp,
} from "./auth.controller.js";

// Accounts are created by the root user (see modules/user), so there is no public signup.
export default async function authRoutes(app: FastifyInstance) {
  const strictLimit = { rateLimit: { max: 10, timeWindow: "1 minute" } };

  app.post(
    "/login",
    {
      config: strictLimit,
      schema: {
        body: {
          type: "object",
          required: ["email", "password"],
          properties: {
            email: { type: "string", format: "email" },
            password: { type: "string", minLength: 1, maxLength: 128 },
          },
        },
      },
    },
    async (request, reply) => login(request, reply, app),
  );

  app.post(
    "/refresh",
    {
      config: { rateLimit: { max: 60, timeWindow: "1 minute" } },
      schema: {
        body: {
          type: ["object", "null"],
          properties: { refreshToken: { type: "string", minLength: 10 } },
        },
      },
    },
    async (request, reply) => renewToken(request, reply, app),
  );

  app.post(
    "/logout",
    {
      schema: {
        body: {
          type: ["object", "null"],
          properties: { refreshToken: { type: "string" } },
        },
      },
    },
    async (request, reply) => logout(request, reply),
  );

  app.get("/me", { preHandler: app.authenticate }, me);

  app.post(
    "/password-reset/request",
    {
      config: strictLimit,
      schema: {
        body: {
          type: "object",
          required: ["email"],
          properties: { email: { type: "string", format: "email" } },
        },
      },
    },
    async (request, reply) => requestPasswordReset(request, reply, app),
  );

  app.post(
    "/password-reset/verify-otp",
    {
      config: strictLimit,
      schema: {
        body: {
          type: "object",
          required: ["email", "otp"],
          properties: {
            email: { type: "string", format: "email" },
            otp: { type: "string", minLength: 6, maxLength: 6 },
          },
        },
      },
    },
    async (request, reply) => verifyPasswordResetOtp(request, reply, app),
  );

  app.post(
    "/password-reset/confirm",
    {
      config: strictLimit,
      schema: {
        body: {
          type: "object",
          required: ["resetToken", "newPassword"],
          properties: {
            resetToken: { type: "string" },
            newPassword: { type: "string", minLength: 8, maxLength: 128 },
          },
        },
      },
    },
    async (request, reply) => resetPassword(request, reply, app),
  );
}
