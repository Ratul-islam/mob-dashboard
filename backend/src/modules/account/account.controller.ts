import { FastifyInstance, FastifyReply, FastifyRequest } from "fastify";
import { toPublicUser } from "../user/user.model.js";
import { comparePassword, getUser, setPassword, updateUserProfile } from "../user/user.services.js";
import { revokeAllTokens } from "../auth/refreshToken.services.js";
import { issueTokens } from "../auth/auth.services.js";
import { getIP } from "../../utils/getIp.js";
import { sendError, sendSuccess } from "../../utils/responses.js";

export const getAccount = async (request: FastifyRequest, reply: FastifyReply) => {
  const user = await getUser({ id: request.authUser!.id });
  if (!user) return sendError(reply, { statusCode: 404, message: "User not found" });
  return sendSuccess(reply, { data: toPublicUser(user) });
};

export const updateAccount = async (request: FastifyRequest, reply: FastifyReply, app: FastifyInstance) => {
  const { name, email, currentPassword } = request.body as {
    name?: string;
    email?: string;
    currentPassword?: string;
  };

  const user = await getUser({ id: request.authUser!.id }, true);
  if (!user) return sendError(reply, { statusCode: 404, message: "User not found" });

  const emailChanged = !!email && email.toLowerCase().trim() !== user.email;
  if (emailChanged && (!currentPassword || !(await comparePassword(currentPassword, user.password)))) {
    return sendError(reply, { statusCode: 400, message: "Current password is incorrect" });
  }

  await updateUserProfile(user, { name, email });

  // Changing the login email invalidates other sessions; keep this one alive.
  let accessToken: string | undefined;
  if (emailChanged) {
    await revokeAllTokens(user.id, getIP(request));
    accessToken = (await issueTokens(app, request, reply, user)).accessToken;
  }

  return sendSuccess(reply, { message: "Account updated", data: { user: toPublicUser(user), accessToken } });
};

export const changePassword = async (request: FastifyRequest, reply: FastifyReply, app: FastifyInstance) => {
  const { currentPassword, newPassword } = request.body as { currentPassword: string; newPassword: string };

  const user = await getUser({ id: request.authUser!.id }, true);
  if (!user) return sendError(reply, { statusCode: 404, message: "User not found" });

  if (!(await comparePassword(currentPassword, user.password))) {
    return sendError(reply, { statusCode: 400, message: "Current password is incorrect" });
  }
  if (currentPassword === newPassword) {
    return sendError(reply, { statusCode: 400, message: "New password must be different" });
  }

  await setPassword(user, newPassword, false);
  await revokeAllTokens(user.id, getIP(request));
  const { accessToken } = await issueTokens(app, request, reply, user);

  return sendSuccess(reply, { message: "Password changed", data: { user: toPublicUser(user), accessToken } });
};
