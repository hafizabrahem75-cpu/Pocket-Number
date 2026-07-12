import rateLimit from "express-rate-limit";

/**
 * Shared limiter for auth endpoints that are attractive brute-force targets
 * (register, login, verify-otp, resend-otp). Keyed by IP; returns a
 * consistent JSON error body rather than the express-rate-limit default.
 */
export const authRateLimit = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  limit: 10,
  standardHeaders: true,
  legacyHeaders: false,
  message: { error: "طلبات كثيرة جداً، يرجى المحاولة لاحقاً" },
});
