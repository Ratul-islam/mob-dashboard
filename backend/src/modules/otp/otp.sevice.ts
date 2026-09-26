import crypto from "node:crypto";
import { and, eq, lt } from "drizzle-orm";
import { db } from "../../config/db.js";
import { IOTP, otps } from "./otp.model.js";
import { AppError } from "../../utils/AppError.js";

export const createOTP = async (userId: number, type: IOTP["type"], length = 6, expiresInMinutes = 10) => {
  await db.delete(otps).where(and(eq(otps.userId, userId), eq(otps.type, type)));
  await db.delete(otps).where(lt(otps.expiresAt, new Date()));

  const otp = crypto.randomInt(10 ** (length - 1), 10 ** length).toString();
  const expiresAt = new Date(Date.now() + expiresInMinutes * 60 * 1000);

  await db.insert(otps).values({ userId, otp, type, expiresAt });

  return otp;
};

export const verifyOTP = async (userId: number, otp: string, type: IOTP["type"]) => {
  const [otpRecord] = await db
    .select()
    .from(otps)
    .where(and(eq(otps.userId, userId), eq(otps.otp, otp), eq(otps.type, type)))
    .limit(1);
  if (!otpRecord) throw new AppError("Invalid OTP", 400);
  if (otpRecord.expiresAt < new Date()) throw new AppError("OTP expired", 400);

  await db.delete(otps).where(eq(otps.id, otpRecord.id));
  return true;
};
