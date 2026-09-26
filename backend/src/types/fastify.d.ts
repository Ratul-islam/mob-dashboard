import "fastify";
import "@fastify/jwt";
import type { FastifyReply, FastifyRequest } from "fastify";
import type { JWT } from "@fastify/jwt";
import type { UserRole } from "../modules/user/user.model.js";

export interface AuthUser {
  id: string;
  role: UserRole;
  email: string;
  name: string;
}

declare module "@fastify/jwt" {
  // Namespaced instances registered in plugins/jwt.ts
  interface JWT {
    access: JWT;
    refresh: JWT;
    reset: JWT;
  }
}

declare module "fastify" {
  interface FastifyInstance {
    authenticate: (request: FastifyRequest, reply: FastifyReply) => Promise<void>;
    requireRoot: (request: FastifyRequest, reply: FastifyReply) => Promise<void>;
  }

  interface FastifyRequest {
    authUser: AuthUser | null;
  }
}
