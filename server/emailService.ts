import nodemailer from "nodemailer";

function required(name: string) {
  const value = process.env[name];
  if (!value) throw new Error(`${name} is not configured.`);
  return value;
}

export function createEmailTransport() {
  const port = Number(required("SMTP_PORT"));
  return nodemailer.createTransport({
    host: required("SMTP_HOST"),
    port,
    secure: port === 465,
    auth: { user: required("SMTP_USERNAME"), pass: required("SMTP_PASSWORD") },
  });
}

export async function verifyEmailTransport() {
  await createEmailTransport().verify();
}

export async function sendPasswordResetEmail(input: { recipient: string; resetUrl: string; expiresMinutes: number }) {
  const from = required("SMTP_FROM");
  await createEmailTransport().sendMail({
    from,
    to: input.recipient,
    subject: "Reset your NeuroScan AI password",
    text: `A password reset was requested for your NeuroScan AI account. Use this secure link within ${input.expiresMinutes} minutes: ${input.resetUrl}\n\nIf you did not request this, you can ignore this email.`,
    html: `<p>A password reset was requested for your NeuroScan AI account.</p><p><a href="${input.resetUrl}">Reset your password</a></p><p>This link expires in ${input.expiresMinutes} minutes. If you did not request this, you can ignore this email.</p>`,
  });
}

export async function sendAccountNotification(input: { recipient: string; subject: string; text: string }) {
  await createEmailTransport().sendMail({ from: required("SMTP_FROM"), to: input.recipient, subject: input.subject, text: input.text });
}
