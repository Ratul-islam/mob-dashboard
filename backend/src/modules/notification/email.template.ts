export const emailTemplates = {
  EMAIL_VERIFICATION: (otp: string, expiresIn: number) => ({
    subject: 'Verify your email',
    html: `<p>Your verification code is <b>${otp}</b>. It expires in ${expiresIn} minutes.</p>`,
  }),

  PASSWORD_RESET: (otp: string, expiresIn: number) => ({
    subject: 'Reset your password',
    html: `<p>Your password reset code is <b>${otp}</b>. It expires in ${expiresIn} minutes.</p>`,
  }),

  TWO_FA: (otp: string, expiresIn: number) => ({
    subject: 'Your login code',
    html: `<p>Your login OTP is <b>${otp}</b>. It expires in ${expiresIn} minutes.</p>`,
  }),
}
