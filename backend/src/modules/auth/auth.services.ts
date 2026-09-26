import { FastifyInstance, FastifyReply, FastifyRequest } from "fastify";
import { getConfig } from "../../config/config.js";
import { sha256 } from "../../utils/util.js";
import { getIP } from "../../utils/getIp.js";
import { UserRecord } from "../user/user.model.js";
import { createRefreshToken } from "./refreshToken.services.js";

export const REFRESH_COOKIE = "rt";
const REFRESH_TTL_MS = 7 * 24 * 60 * 60 * 1000;

/** Signs a new access/refresh pair, persists the refresh hash and sets the httpOnly cookie. */
export const issueTokens = async (
  app: FastifyInstance,
  request: FastifyRequest,
  reply: FastifyReply,
  user: UserRecord,
) => {
  const sub = String(user.id);
  const accessToken = app.jwt.access.sign({ sub, role: user.role });
  // jti keeps two refresh tokens issued in the same second distinct.
  const refreshToken = app.jwt.refresh.sign({ sub, jti: crypto.randomUUID() });
  const refreshHash = sha256(refreshToken);

  await createRefreshToken(user.id, refreshHash, new Date(Date.now() + REFRESH_TTL_MS), getIP(request));
  setRefreshCookie(reply, refreshToken);

  return { accessToken, refreshToken, refreshHash };
};

export const setRefreshCookie = (reply: FastifyReply, token: string) => {
  reply.setCookie(REFRESH_COOKIE, token, {
    httpOnly: true,
    secure: getConfig().COOKIE_SECURE,
    sameSite: "lax",
    path: "/api/v1/auth",
    maxAge: REFRESH_TTL_MS / 1000,
  });
};

export const clearRefreshCookie = (reply: FastifyReply) => {
  reply.clearCookie(REFRESH_COOKIE, { path: "/api/v1/auth" });
};

/** Web clients send the refresh token as a cookie; other clients may send it in the body. */
export const readRefreshToken = (request: FastifyRequest): string | undefined => {
  const body = request.body as { refreshToken?: string } | undefined;
  return body?.refreshToken || request.cookies?.[REFRESH_COOKIE];
};
