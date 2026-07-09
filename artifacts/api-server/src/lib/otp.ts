import { randomInt } from "crypto";
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
 * Sends an OTP to the user's email.
 * Currently operates in dev mode — replace with a real email provider in a future phase.
 */
export async function sendOtpEmail(email: string, code: string): Promise<void> {
  // TODO: Integrate with a real email provider (e.g. Resend, SendGrid) in a future phase.
  // IMPORTANT: Do NOT log the OTP code in production — only log that an OTP was sent.
  logger.info({ email }, "OTP email dispatched (dev mode)");

  // In development only, print to stderr for testing purposes
  if (process.env.NODE_ENV !== "production") {
    process.stderr.write(`[DEV OTP] ${email} → ${code}\n`);
  }
}
