import nodemailer from "nodemailer";
import type { FastifyInstance } from "fastify";
import { getConfig } from "../config/config.js";

interface EmailOptions {
  to: string;
  subject: string;
  html: string;
}

export const sendEmail = async (fastify: FastifyInstance, { to, subject, html }: EmailOptions) => {
  const config = getConfig();
  const transporter = nodemailer.createTransport({
    host: config.SMTP_HOST,
    port: config.SMTP_PORT,
    auth: {
      user: config.SMTP_USER,
      pass: config.SMTP_PASS,
    },
  });

  await transporter.sendMail({
    from: config.SMTP_FROM,
    to,
    subject,
    html,
  });
};
