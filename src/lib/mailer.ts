import nodemailer, { type Transporter } from "nodemailer";
import { OTP_TTL_MINUTES } from "./otp";

/**
 * Outgoing mail over SMTP (Brevo).
 *
 * When SMTP is not configured the login code is written to the server log
 * instead, so the flow stays testable before mail is wired up. The code is never
 * returned to the browser either way.
 */

export interface SendResult {
  delivered: boolean;
  /** True when no transport is configured and the code went to the server log. */
  fallbackToLog: boolean;
}

export function mailConfigured(): boolean {
  return Boolean(process.env.SMTP_HOST && process.env.SMTP_USER && process.env.SMTP_PASS);
}

let cached: Transporter | null = null;

function transport(): Transporter {
  if (cached) return cached;
  const port = Number(process.env.SMTP_PORT ?? 587);
  cached = nodemailer.createTransport({
    host: process.env.SMTP_HOST,
    port,
    // 587 is STARTTLS: connect in the clear, then upgrade. Only 465 is
    // implicit TLS from the first byte.
    secure: port === 465,
    requireTLS: port === 587,
    auth: { user: process.env.SMTP_USER, pass: process.env.SMTP_PASS },
  });
  return cached;
}

/** Authenticates against the SMTP server without sending anything. */
export async function verifyMailTransport(): Promise<{ ok: boolean; error?: string }> {
  if (!mailConfigured()) return { ok: false, error: "SMTP settings are incomplete" };
  try {
    await transport().verify();
    return { ok: true };
  } catch (err) {
    return { ok: false, error: err instanceof Error ? err.message : String(err) };
  }
}

function senderAddress(): string {
  // Brevo rejects a From address that is not a verified sender on the account.
  return process.env.MAIL_FROM ?? "Esvita Assessment Center <no-reply@esvitaclinic.com>";
}

export async function sendLoginCode(
  to: string,
  username: string,
  code: string,
): Promise<SendResult> {
  if (!mailConfigured()) {
    console.warn(
      `\n[esvita] SMTP is not configured (SMTP_HOST / SMTP_USER / SMTP_PASS).\n` +
        `[esvita] Login code for "${username}" <${to}>: ${code}  (valid ${OTP_TTL_MINUTES} min)\n`,
    );
    return { delivered: false, fallbackToLog: true };
  }

  await transport().sendMail({
    from: senderAddress(),
    to,
    subject: `Your Esvita Assessment Center code: ${code}`,
    text: [
      `Hi ${username},`,
      ``,
      `Your sign-in code for the Esvita Assessment Center: ${code}`,
      ``,
      `The code is valid for ${OTP_TTL_MINUTES} minutes and can only be used once.`,
      `If you did not request this, you can ignore this email.`,
    ].join("\n"),
    html: `
      <div style="font-family:ui-sans-serif,system-ui,-apple-system,'Segoe UI',Roboto,sans-serif;max-width:520px;margin:0 auto;padding:32px 24px;color:#0f1720">
        <p style="margin:0 0 4px;font-size:12px;letter-spacing:.15em;text-transform:uppercase;color:#0d7a6f;font-weight:600">Esvita Assessment Center</p>
        <h1 style="margin:0 0 16px;font-size:20px;font-weight:600">Your sign-in code</h1>
        <p style="margin:0 0 20px;font-size:14px;line-height:1.6">Hi ${username}, here is your code:</p>
        <p style="margin:0 0 20px;font-size:32px;font-weight:600;letter-spacing:.2em;font-family:ui-monospace,SFMono-Regular,Menlo,monospace">${code}</p>
        <p style="margin:0 0 8px;font-size:13px;color:#5b6875;line-height:1.6">
          This code is valid for ${OTP_TTL_MINUTES} minutes and can only be used once.
        </p>
        <p style="margin:0;font-size:13px;color:#5b6875;line-height:1.6">
          If you did not request this, you can safely ignore this email.
        </p>
      </div>`.trim(),
  });

  return { delivered: true, fallbackToLog: false };
}
