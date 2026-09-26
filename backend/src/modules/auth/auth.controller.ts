import { FastifyInstance, FastifyReply, FastifyRequest } from "fastify";
import { sha256 } from "../../utils/util.js";
import { getIP } from "../../utils/getIp.js";
import { comparePassword, getUser, setPassword, updateUser } from "../user/user.services.js";
import { toPublicUser } from "../user/user.model.js";
import { createOTP, verifyOTP } from "../otp/otp.sevice.js";
import { sendError, sendSuccess } from "../../utils/responses.js";
import { sendOTPEmail } from "../notification/notification.service.js";
import { findRefreshToken, revokeAllTokens, revokeRefreshToken } from "./refreshToken.services.js";
import { clearRefreshCookie, issueTokens, readRefreshToken } from "./auth.services.js";

export const login = async (request: FastifyRequest, reply: FastifyReply, app: FastifyInstance) => {
  const { email, password } = request.body as { email: string; password: string };

  const user = await getUser({ email }, true);
  // Same message for unknown email / wrong password / disabled account.
  if (!user || !user.isActive || !(await comparePassword(password, user.password))) {
    return sendError(reply, { statusCode: 401, message: "Invalid email or password" });
  }

  user.lastLoginAt = new Date();
  await updateUser(user.id, { lastLoginAt: user.lastLoginAt });

  const { accessToken, refreshToken } = await issueTokens(app, request, reply, user);
  return sendSuccess(reply, { data: { accessToken, refreshToken, user: toPublicUser(user) } });
};

export const renewToken = async (request: FastifyRequest, reply: FastifyReply, app: FastifyInstance) => {
  const refreshToken = readRefreshToken(request);
  const fail = (message: string) => {
    clearRefreshCookie(reply);
    return sendError(reply, { statusCode: 401, message });
  };
  if (!refreshToken) return fail("Missing refresh token");

  let payload: { sub: string };
  try {
    payload = app.jwt.refresh.verify(refreshToken);
  } catch {
    return fail("Invalid refresh token");
  }

  const stored = await findRefreshToken(sha256(refreshToken));
  if (!stored) return fail("Refresh token not found");

  if (stored.revokedAt) {
    // A rotated token being replayed means it may have leaked: end every session for this user.
    if (stored.replacedByTokenHash) await revokeAllTokens(stored.userId, getIP(request));
    return fail("Refresh token revoked");
  }
  if (stored.expiresAt.getTime() < Date.now()) return fail("Refresh token expired");

  const user = await getUser({ id: payload.sub });
  if (!user || !user.isActive) return fail("Account disabled");

  const next = await issueTokens(app, request, reply, user);
  await revokeRefreshToken(stored.id, getIP(request), next.refreshHash);

  return sendSuccess(reply, {
    data: { accessToken: next.accessToken, refreshToken: next.refreshToken, user: toPublicUser(user) },
  });
};

export const logout = async (request: FastifyRequest, reply: FastifyReply) => {
  const refreshToken = readRefreshToken(request);
  if (refreshToken) {
    const stored = await findRefreshToken(sha256(refreshToken));
    if (stored && !stored.revokedAt) await revokeRefreshToken(stored.id, getIP(request));
  }
  clearRefreshCookie(reply);
  return sendSuccess(reply, { message: "successfully logged out" });
};

export const me = async (request: FastifyRequest, reply: FastifyReply) => {
  const user = await getUser({ id: request.authUser!.id });
  if (!user) return sendError(reply, { statusCode: 404, message: "User not found" });
  return sendSuccess(reply, { data: toPublicUser(user) });
};

const RESET_REQUEST_MESSAGE = "If an account exists for this email, a verification code has been sent";

export const requestPasswordReset = async (
  request: FastifyRequest,
  reply: FastifyReply,
  app: FastifyInstance,
) => {
  const { email } = request.body as { email: string };

  const user = await getUser({ email });
  // Don't reveal whether the email exists.
  if (!user || !user.isActive) return sendSuccess(reply, { message: RESET_REQUEST_MESSAGE });

  const expiresInMinutes = 10;
  const otp = await createOTP(user.id, "PASSWORD_RESET", 6, expiresInMinutes);
  await sendOTPEmail(app, user.email, otp, "PASSWORD_RESET", expiresInMinutes);

  return sendSuccess(reply, { message: RESET_REQUEST_MESSAGE });
};

export const verifyPasswordResetOtp = async (
  request: FastifyRequest,
  reply: FastifyReply,
  app: FastifyInstance,
) => {
  const { email, otp } = request.body as { email: string; otp: string };

  const user = await getUser({ email });
  if (!user || !user.isActive) {
    return sendError(reply, { statusCode: 400, message: "Invalid OTP" });
  }

  try {
    await verifyOTP(user.id, otp, "PASSWORD_RESET");
  } catch {
    return sendError(reply, { statusCode: 400, message: "Invalid or expired OTP" });
  }

  const resetToken = app.jwt.reset.sign({ sub: String(user.id), typ: "password_reset" });
  return sendSuccess(reply, { data: { resetToken } });
};

export const resetPassword = async (request: FastifyRequest, reply: FastifyReply, app: FastifyInstance) => {
  const { resetToken, newPassword } = request.body as { resetToken: string; newPassword: string };

  let payload: { sub: string; typ?: string };
  try {
    payload = app.jwt.reset.verify(resetToken);
  } catch {
    return sendError(reply, { statusCode: 401, message: "Invalid or expired reset token" });
  }
  if (payload?.typ !== "password_reset") {
    return sendError(reply, { statusCode: 401, message: "Invalid reset token" });
  }

  const user = await getUser({ id: payload.sub });
  if (!user || !user.isActive) {
    return sendError(reply, { statusCode: 400, message: "Invalid reset token" });
  }

  await setPassword(user, newPassword, false);
  await revokeAllTokens(user.id, getIP(request));

  return sendSuccess(reply, { message: "Password updated. Please sign in." });
};
