import { randomInt } from "crypto";
import { createTransport } from "nodemailer";
import { logger } from "./logger";

/**
 * Generates a cryptographically secure 6-digit OTP code.
 */
export function generateOtpCode(): string {
  // randomInt(min, max) is inclusive of min, exclusive of max
  const code = randomInt(100000, 1000000).toString();
  return code;
}

/**
 * Returns an expiry date 10 minutes from now.
 */
export function getOtpExpiry(): Date {
  const expiry = new Date();
  expiry.setMinutes(expiry.getMinutes() + 10);
  return expiry;
}

/**
 * Returns true when all four SMTP environment variables are present.
 * When false, email sending falls back to stderr (dev mode only).
 */
function isSmtpConfigured(): boolean {
  return !!(
    process.env.SMTP_HOST &&
    process.env.SMTP_PORT &&
    process.env.SMTP_USER &&
    process.env.SMTP_PASSWORD
  );
}

/**
 * Builds and returns a nodemailer transporter from the four required
 * environment variables: SMTP_HOST, SMTP_PORT, SMTP_USER, SMTP_PASSWORD.
 *
 * Port 465 → implicit TLS (secure: true).
 * Any other port → STARTTLS opportunistic upgrade (secure: false).
 */
function createSmtpTransport() {
  const port = Number(process.env.SMTP_PORT);
  return createTransport({
    host: process.env.SMTP_HOST,
    port,
    secure: port === 465,
    auth: {
      user: process.env.SMTP_USER,
      pass: process.env.SMTP_PASSWORD,
    },
  });
}

/**
 * Sends an OTP code to the given email address.
 *
 * Production path (all four SMTP_* vars set):
 *   Connects via SMTP and sends a plain-text + HTML email.
 *   Throws if the SMTP connection or message delivery fails so the
 *   calling route can return a 500 to the client instead of silently
 *   dropping the code.
 *
 * Development fallback (any SMTP_* var missing):
 *   Logs the code to stderr only — no real email is sent.
 *   Never used in production because NODE_ENV=production requires SMTP vars.
 */
export async function sendOtpEmail(email: string, code: string): Promise<void> {
  if (!isSmtpConfigured()) {
    // Development fallback — print to stderr, never log the code at INFO level.
    if (process.env.NODE_ENV !== "production") {
      process.stderr.write(`[DEV OTP] ${email} → ${code}\n`);
      logger.info({ email }, "OTP email dispatched (dev fallback — SMTP not configured)");
      return;
    }
    // In production with SMTP vars missing, fail loudly.
    throw new Error(
      "Email delivery is not configured. Set SMTP_HOST, SMTP_PORT, SMTP_USER, and SMTP_PASSWORD.",
    );
  }

  const transporter = createSmtpTransport();

  const subject = "رمز التحقق الخاص بك - Pocket Number";

  const text = [
    `مرحباً،`,
    ``,
    `رمز التحقق الخاص بك هو: ${code}`,
    ``,
    `هذا الرمز صالح لمدة 10 دقائق ولا يمكن استخدامه إلا مرة واحدة.`,
    `إذا لم تطلب هذا الرمز، يمكنك تجاهل هذه الرسالة بأمان.`,
    ``,
    `— فريق Pocket Number`,
  ].join("\n");

  const html = `
<!DOCTYPE html>
<html dir="rtl" lang="ar">
<head><meta charset="UTF-8"></head>
<body style="font-family:Arial,sans-serif;background:#f5f5f5;margin:0;padding:24px;">
  <table width="100%" cellpadding="0" cellspacing="0" style="max-width:480px;margin:0 auto;">
    <tr>
      <td style="background:#ffffff;border-radius:12px;padding:32px;text-align:right;">
        <p style="font-size:16px;color:#111;margin:0 0 24px;">مرحباً،</p>
        <p style="font-size:14px;color:#444;margin:0 0 16px;line-height:1.6;">
          رمز التحقق الخاص بك هو:
        </p>
        <div style="background:#f0f0ff;border:1px solid #c7c7ff;border-radius:8px;padding:20px;text-align:center;margin:0 0 24px;">
          <span style="font-size:36px;font-weight:900;letter-spacing:8px;color:#4f46e5;font-family:monospace;">
            ${code}
          </span>
        </div>
        <p style="font-size:13px;color:#888;margin:0 0 8px;line-height:1.6;">
          هذا الرمز صالح لمدة <strong>10 دقائق</strong> ولا يمكن استخدامه إلا مرة واحدة.
        </p>
        <p style="font-size:13px;color:#888;margin:0;line-height:1.6;">
          إذا لم تطلب هذا الرمز، يمكنك تجاهل هذه الرسالة بأمان.
        </p>
      </td>
    </tr>
    <tr>
      <td style="padding:16px 0;text-align:center;">
        <p style="font-size:12px;color:#aaa;margin:0;">— فريق Pocket Number</p>
      </td>
    </tr>
  </table>
</body>
</html>
  `.trim();

  try {
    await transporter.sendMail({
      from: `"Pocket Number" <${process.env.SMTP_USER}>`,
      to: email,
      subject,
      text,
      html,
    });
    // Log that an OTP was sent — never log the code itself.
    logger.info({ email }, "OTP email sent via SMTP");
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : String(err);
    logger.error({ email, err: message }, "Failed to send OTP email via SMTP");
    throw new Error(`Failed to send verification email to ${email}. Please try again later.`);
  }
}
