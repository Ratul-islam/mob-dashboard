import { sendEmail } from "../../utils/email.js";
import { emailTemplates } from "./email.template.js";
import { getConfig } from "../../config/config.js";
import type { IOTP } from "../otp/otp.model.js";
import type { FastifyInstance } from "fastify";

export const sendOTPEmail = async (
  fastify: FastifyInstance,
  email: string,
  otp: string,
  type: IOTP["type"],
  expiresInMinutes: number,
) => {
  const template = emailTemplates[type];
  if (!template) {
    throw new Error(`No email template defined for OTP type: ${type}`);
  }

  const config = getConfig();
  if (!config.SMTP_HOST) {
    // Without SMTP, only surface the code locally so the flow can still be tested.
    if (!config.isProduction) fastify.log.warn(`SMTP not configured. ${type} code for ${email}: ${otp}`);
    else fastify.log.error("SMTP not configured; cannot send OTP email");
    return;
  }

  const { subject, html } = template(otp, expiresInMinutes);
  await sendEmail(fastify, { to: email, subject, html });
};
