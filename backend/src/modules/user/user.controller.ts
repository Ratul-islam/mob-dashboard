import { FastifyReply, FastifyRequest } from "fastify";
import { toPublicUser } from "./user.model.js";
import {
  createUser,
  deleteUser,
  generatePassword,
  getUser,
  listUsers,
  setPassword,
  updateUser,
  updateUserProfile,
} from "./user.services.js";
import { revokeAllTokens } from "../auth/refreshToken.services.js";
import { getIP } from "../../utils/getIp.js";
import { sendError, sendSuccess } from "../../utils/responses.js";

type IdParams = { id: string };

export const list = async (_request: FastifyRequest, reply: FastifyReply) => {
  const users = await listUsers();
  return sendSuccess(reply, { data: users.map(toPublicUser) });
};

export const create = async (request: FastifyRequest, reply: FastifyReply) => {
  const { name, email, password } = request.body as { name: string; email: string; password?: string };

  // When root doesn't choose a password, generate one and show it once.
  const initialPassword = password || generatePassword();
  const user = await createUser({
    name,
    email,
    password: initialPassword,
    mustChangePassword: true,
    createdBy: Number(request.authUser!.id),
  });

  return sendSuccess(reply, {
    statusCode: 201,
    message: "User created",
    data: { user: toPublicUser(user), initialPassword },
  });
};

export const update = async (request: FastifyRequest, reply: FastifyReply) => {
  const { id } = request.params as IdParams;
  const body = request.body as { name?: string; email?: string; isActive?: boolean };

  const user = await getUser({ id });
  if (!user) return sendError(reply, { statusCode: 404, message: "User not found" });
  if (user.role === "root" && body.isActive === false) {
    return sendError(reply, { statusCode: 400, message: "The root user cannot be deactivated" });
  }

  await updateUserProfile(user, body);
  if (typeof body.isActive === "boolean" && body.isActive !== user.isActive) {
    user.isActive = body.isActive;
    await updateUser(user.id, { isActive: user.isActive });
    if (!user.isActive) await revokeAllTokens(user.id, getIP(request));
  }

  return sendSuccess(reply, { message: "User updated", data: toPublicUser(user) });
};

export const resetPassword = async (request: FastifyRequest, reply: FastifyReply) => {
  const { id } = request.params as IdParams;
  const { password } = (request.body ?? {}) as { password?: string };

  const user = await getUser({ id });
  if (!user) return sendError(reply, { statusCode: 404, message: "User not found" });
  if (user.role === "root") {
    return sendError(reply, { statusCode: 400, message: "Change the root password from the account page" });
  }

  const newPassword = password || generatePassword();
  await setPassword(user, newPassword, true);
  await revokeAllTokens(user.id, getIP(request));

  return sendSuccess(reply, { message: "Password reset", data: { password: newPassword } });
};

export const remove = async (request: FastifyRequest, reply: FastifyReply) => {
  const { id } = request.params as IdParams;

  const user = await getUser({ id });
  if (!user) return sendError(reply, { statusCode: 404, message: "User not found" });
  if (user.role === "root") {
    return sendError(reply, { statusCode: 400, message: "The root user cannot be deleted" });
  }

  await revokeAllTokens(user.id, getIP(request));
  await deleteUser(user.id);
  return sendSuccess(reply, { message: "User deleted" });
};
