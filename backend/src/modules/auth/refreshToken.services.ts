import { and, eq, isNull, lt } from "drizzle-orm";
import { db } from "../../config/db.js";
import { refreshTokens } from "./refreshToken.model.js";

export const createRefreshToken = async (
  userId: number,
  tokenHash: string,
  expiresAt: Date,
  createdByIp: string,
) => {
  await db.insert(refreshTokens).values({ userId, tokenHash, expiresAt, createdByIp });
  // Housekeeping: drop tokens that expired a while ago.
  await db.delete(refreshTokens).where(lt(refreshTokens.expiresAt, new Date(Date.now() - 24 * 60 * 60 * 1000)));
};

export const findRefreshToken = async (tokenHash: string) => {
  const [token] = await db.select().from(refreshTokens).where(eq(refreshTokens.tokenHash, tokenHash)).limit(1);
  return token ?? null;
};

export const revokeRefreshToken = async (id: number, ip: string, replacedByTokenHash?: string) => {
  await db
    .update(refreshTokens)
    .set({ revokedAt: new Date(), revokedByIp: ip, replacedByTokenHash })
    .where(eq(refreshTokens.id, id));
};

export const revokeAllTokens = async (userId: number, ip: string) => {
  await db
    .update(refreshTokens)
    .set({ revokedAt: new Date(), revokedByIp: ip })
    .where(and(eq(refreshTokens.userId, userId), isNull(refreshTokens.revokedAt)));
};
