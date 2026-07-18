import rateLimit from "express-rate-limit";

const DEFAULT_WINDOW_MS = 15 * 60 * 1000; // 15 minutes
const DEFAULT_LIMIT = 10;
const ERROR_MESSAGE = { error: "طلبات كثيرة جداً، يرجى المحاولة لاحقاً" };

/**
 * Independent rate limiters for each auth endpoint.
 * All share the same window/limit (10 req / 15 min per IP) but are keyed
 * separately so that attempts on one endpoint never consume quota on another.
 * Previously a single shared limiter meant a wrong OTP attempt counted against
 * login quota (and vice-versa), locking users out of unrelated flows.
 */

/** POST /auth/register */
export const registerRateLimit = rateLimit({
  windowMs: DEFAULT_WINDOW_MS,
  limit: DEFAULT_LIMIT,
  standardHeaders: true,
  legacyHeaders: false,
  message: ERROR_MESSAGE,
});

/** POST /auth/login */
export const loginRateLimit = rateLimit({
  windowMs: DEFAULT_WINDOW_MS,
  limit: DEFAULT_LIMIT,
  standardHeaders: true,
  legacyHeaders: false,
  message: ERROR_MESSAGE,
});

/** POST /auth/verify-otp */
export const verifyOtpRateLimit = rateLimit({
  windowMs: DEFAULT_WINDOW_MS,
  limit: DEFAULT_LIMIT,
  standardHeaders: true,
  legacyHeaders: false,
  message: ERROR_MESSAGE,
});

/** POST /auth/resend-otp */
export const resendOtpRateLimit = rateLimit({
  windowMs: DEFAULT_WINDOW_MS,
  limit: DEFAULT_LIMIT,
  standardHeaders: true,
  legacyHeaders: false,
  message: ERROR_MESSAGE,
});

/** POST /auth/forgot-password */
export const forgotPasswordRateLimit = rateLimit({
  windowMs: DEFAULT_WINDOW_MS,
  limit: DEFAULT_LIMIT,
  standardHeaders: true,
  legacyHeaders: false,
  message: ERROR_MESSAGE,
});

/** POST /auth/reset-password */
export const resetPasswordRateLimit = rateLimit({
  windowMs: DEFAULT_WINDOW_MS,
  limit: DEFAULT_LIMIT,
  standardHeaders: true,
  legacyHeaders: false,
  message: ERROR_MESSAGE,
});
