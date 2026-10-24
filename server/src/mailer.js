const nodemailer = require('nodemailer');

// No console-code fallback: missing SMTP disables new signups rather than bypassing verification.
function createMailer(env = process.env) {
  if (!env.SMTP_HOST || !env.MAIL_FROM) return null;
  const port = Number(env.SMTP_PORT || 587);
  if (!Number.isInteger(port) || port < 1 || port > 65535) throw new Error('Invalid SMTP_PORT');
  const transport = nodemailer.createTransport({
    host: env.SMTP_HOST,
    port,
    secure: port === 465,
    requireTLS: true,
    auth: env.SMTP_USER ? { user: env.SMTP_USER, pass: env.SMTP_PASSWORD } : undefined,
    connectionTimeout: 10000,
    greetingTimeout: 10000,
    socketTimeout: 15000,
    disableFileAccess: true,
    disableUrlAccess: true,
  });
  return {
    async sendSignupCode({ email, code }) {
      const result = await transport.sendMail({
        from: env.MAIL_FROM,
        to: email,
        subject: 'Your Food Hunt verification code',
        text: `Your Food Hunt verification code is ${code}. It expires in 10 minutes. If you did not request this code, you can ignore this email.`,
      });
      if (!result.accepted?.length) throw new Error('Message not accepted');
    },
  };
}
module.exports = { createMailer };
