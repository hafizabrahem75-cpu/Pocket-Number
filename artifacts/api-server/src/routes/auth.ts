import { Router, type IRouter } from "express";
import { eq, and, gt } from "drizzle-orm";
import bcrypt from "bcryptjs";
import { db, usersTable, otpCodesTable } from "@workspace/db";
import {
  RegisterBody,
  VerifyOtpBody,
  ResendOtpBody,
  LoginBody,
  GetMeResponse,
  RegisterResponse,
  VerifyOtpResponse,
  ResendOtpResponse,
  LoginResponse,
  LogoutResponse,
  UpdateMeBody,
  ChangePasswordBody,
  DeleteMeBody,
} from "@workspace/api-zod";
import { signToken } from "../lib/jwt";
import { generateOtpCode, getOtpExpiry, sendOtpEmail } from "../lib/otp";
import { requireAuth, type AuthRequest } from "../middlewares/auth";
import { authRateLimit } from "../middlewares/rateLimit";
import { getPocketNumberConfig } from "../lib/settings";

const router: IRouter = Router();

// ── Pocket Number Generation ─────────────────────────────────────────────────

// Total local digits after the prefix (matches the previous 9-digit scheme:
// e.g. old "71XXXXXXX" was 2-char prefix + 7 digits).
const LOCAL_SUFFIX_LENGTH = 7;

/**
 * Generates a unique pocket number as `<countryCode> <prefix>XXXXXXX`
 * (e.g. "+967 76XXXXXXX"). Country code and prefix are Admin-configurable
 * runtime settings (see `../lib/settings`), not hardcoded, so they can change
 * without a code deploy. Only affects newly generated numbers — existing
 * pocket numbers keep their original format.
 * Retries on collision (DB unique constraint) up to 10 times.
 */
async function generatePocketNumber(): Promise<string> {
  const { countryCode, prefix } = await getPocketNumberConfig();
  const max = Math.pow(10, LOCAL_SUFFIX_LENGTH);

  for (let attempt = 0; attempt < 10; attempt++) {
    const suffix = String(Math.floor(Math.random() * max)).padStart(LOCAL_SUFFIX_LENGTH, "0");
    const candidate = `${countryCode} ${prefix}${suffix}`;

    const [existing] = await db
      .select({ id: usersTable.id })
      .from(usersTable)
      .where(eq(usersTable.pocketNumber, candidate));

    if (!existing) return candidate;
  }
  throw new Error("فشل توليد رقم جيب فريد — يرجى المحاولة مرة أخرى");
}

// ── Helpers ──────────────────────────────────────────────────────────────────

function serializeUser(user: typeof usersTable.$inferSelect) {
  return {
    id: user.id,
    pocketNumber: user.pocketNumber,
    name: user.name,
    email: user.email,
    isVerified: user.isVerified,
    isOnline: user.isOnline,
    lastSeenAt: user.lastSeenAt?.toISOString() ?? null,
    createdAt: user.createdAt.toISOString(),
  };
}

// ── POST /auth/register ───────────────────────────────────────────────────────

router.post("/auth/register", authRateLimit, async (req, res): Promise<void> => {
  const parsed = RegisterBody.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.message });
    return;
  }

  const { name, email, password } = parsed.data;
  const lowerEmail = email.toLowerCase().trim();

  const [existing] = await db
    .select({ id: usersTable.id })
    .from(usersTable)
    .where(eq(usersTable.email, lowerEmail));

  if (existing) {
    res.status(409).json({ error: "هذا البريد الإلكتروني مسجل مسبقاً" });
    return;
  }

  const passwordHash = await bcrypt.hash(password, 12);
  const pocketNumber = await generatePocketNumber();

  await db.insert(usersTable).values({
    name: name.trim(),
    email: lowerEmail,
    passwordHash,
    pocketNumber,
    isVerified: false,
    isOnline: false,
  });

  await db
    .update(otpCodesTable)
    .set({ used: true })
    .where(eq(otpCodesTable.email, lowerEmail));

  const code = generateOtpCode();
  const expiresAt = getOtpExpiry();
  await db.insert(otpCodesTable).values({ email: lowerEmail, code, expiresAt });
  await sendOtpEmail(lowerEmail, code);

  req.log.info({ email: lowerEmail }, "User registered, OTP sent");
  const registerPayload: { message: string; devOtp?: string } = {
    message: "تم إرسال رمز التحقق إلى بريدك الإلكتروني",
  };
  if (process.env.NODE_ENV !== "production") {
    registerPayload.devOtp = code;
  }
  res.status(201).json(RegisterResponse.parse(registerPayload));
});

// ── POST /auth/verify-otp ────────────────────────────────────────────────────

router.post("/auth/verify-otp", authRateLimit, async (req, res): Promise<void> => {
  const parsed = VerifyOtpBody.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.message });
    return;
  }

  const { email, code } = parsed.data;
  const lowerEmail = email.toLowerCase().trim();
  const now = new Date();

  const [otp] = await db
    .select()
    .from(otpCodesTable)
    .where(
      and(
        eq(otpCodesTable.email, lowerEmail),
        eq(otpCodesTable.code, code),
        eq(otpCodesTable.used, false),
        gt(otpCodesTable.expiresAt, now),
      ),
    )
    .orderBy(otpCodesTable.createdAt)
    .limit(1);

  if (!otp) {
    res.status(400).json({ error: "رمز التحقق غير صحيح أو انتهت صلاحيته" });
    return;
  }

  await db
    .update(otpCodesTable)
    .set({ used: true })
    .where(eq(otpCodesTable.id, otp.id));

  const [user] = await db
    .update(usersTable)
    .set({ isVerified: true, isOnline: true, lastSeenAt: now })
    .where(eq(usersTable.email, lowerEmail))
    .returning();

  if (!user) {
    res.status(400).json({ error: "المستخدم غير موجود" });
    return;
  }

  const token = signToken({ userId: user.id, email: user.email });

  req.log.info({ userId: user.id }, "User verified and logged in");
  res.json(VerifyOtpResponse.parse({ token, user: serializeUser(user) }));
});

// ── POST /auth/resend-otp ────────────────────────────────────────────────────

router.post("/auth/resend-otp", authRateLimit, async (req, res): Promise<void> => {
  const parsed = ResendOtpBody.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.message });
    return;
  }

  const { email } = parsed.data;
  const lowerEmail = email.toLowerCase().trim();

  const [user] = await db
    .select()
    .from(usersTable)
    .where(eq(usersTable.email, lowerEmail));

  if (!user) {
    res.status(400).json({ error: "البريد الإلكتروني غير موجود" });
    return;
  }

  if (user.isVerified) {
    res.status(400).json({ error: "الحساب مفعّل بالفعل" });
    return;
  }

  await db
    .update(otpCodesTable)
    .set({ used: true })
    .where(eq(otpCodesTable.email, lowerEmail));

  const code = generateOtpCode();
  const expiresAt = getOtpExpiry();
  await db.insert(otpCodesTable).values({ email: lowerEmail, code, expiresAt });
  await sendOtpEmail(lowerEmail, code);

  req.log.info({ email: lowerEmail }, "OTP resent");
  const resendPayload: { message: string; devOtp?: string } = {
    message: "تم إعادة إرسال رمز التحقق",
  };
  if (process.env.NODE_ENV !== "production") {
    resendPayload.devOtp = code;
  }
  res.json(ResendOtpResponse.parse(resendPayload));
});

// ── POST /auth/login ─────────────────────────────────────────────────────────

router.post("/auth/login", authRateLimit, async (req, res): Promise<void> => {
  const parsed = LoginBody.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.message });
    return;
  }

  const { email, password } = parsed.data;
  const lowerEmail = email.toLowerCase().trim();

  const [user] = await db
    .select()
    .from(usersTable)
    .where(eq(usersTable.email, lowerEmail));

  if (!user) {
    res.status(401).json({ error: "بيانات الدخول غير صحيحة" });
    return;
  }

  const passwordMatch = await bcrypt.compare(password, user.passwordHash);
  if (!passwordMatch) {
    res.status(401).json({ error: "بيانات الدخول غير صحيحة" });
    return;
  }

  if (user.isSuspended) {
    res.status(403).json({ error: "تم تعليق هذا الحساب" });
    return;
  }

  if (!user.isVerified) {
    res.status(403).json({ error: "يرجى تفعيل حسابك عبر رمز التحقق المرسل إلى بريدك الإلكتروني" });
    return;
  }

  const now = new Date();
  const [updated] = await db
    .update(usersTable)
    .set({ isOnline: true, lastSeenAt: now })
    .where(eq(usersTable.id, user.id))
    .returning();

  const token = signToken({ userId: user.id, email: user.email });

  req.log.info({ userId: user.id }, "User logged in");
  res.json(LoginResponse.parse({ token, user: serializeUser(updated ?? { ...user, isOnline: true, lastSeenAt: now }) }));
});

// ── POST /auth/logout ────────────────────────────────────────────────────────

router.post("/auth/logout", requireAuth, async (req: AuthRequest, res): Promise<void> => {
  await db
    .update(usersTable)
    .set({ isOnline: false, lastSeenAt: new Date() })
    .where(eq(usersTable.id, req.userId!));

  res.json(LogoutResponse.parse({ message: "تم تسجيل الخروج بنجاح" }));
});

// ── GET /auth/me ─────────────────────────────────────────────────────────────

router.get("/auth/me", requireAuth, async (req: AuthRequest, res): Promise<void> => {
  const [user] = await db
    .select()
    .from(usersTable)
    .where(eq(usersTable.id, req.userId!));

  if (!user) {
    res.status(401).json({ error: "المستخدم غير موجود" });
    return;
  }

  res.json(GetMeResponse.parse(serializeUser(user)));
});

// ── PATCH /auth/me — update display name ─────────────────────────────────────

router.patch("/auth/me", requireAuth, async (req: AuthRequest, res): Promise<void> => {
  const parsed = UpdateMeBody.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.message });
    return;
  }

  const { name } = parsed.data;

  const [updated] = await db
    .update(usersTable)
    .set({ name: name.trim() })
    .where(eq(usersTable.id, req.userId!))
    .returning();

  if (!updated) {
    res.status(404).json({ error: "المستخدم غير موجود" });
    return;
  }

  req.log.info({ userId: req.userId }, "User updated name");
  res.json(serializeUser(updated));
});

// ── PATCH /auth/password — change password ────────────────────────────────────

router.patch("/auth/password", requireAuth, async (req: AuthRequest, res): Promise<void> => {
  const parsed = ChangePasswordBody.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.message });
    return;
  }

  const { currentPassword, newPassword } = parsed.data;

  const [user] = await db
    .select()
    .from(usersTable)
    .where(eq(usersTable.id, req.userId!));

  if (!user) {
    res.status(404).json({ error: "المستخدم غير موجود" });
    return;
  }

  const match = await bcrypt.compare(currentPassword, user.passwordHash);
  if (!match) {
    res.status(400).json({ error: "كلمة المرور الحالية غير صحيحة" });
    return;
  }

  const newHash = await bcrypt.hash(newPassword, 12);
  await db
    .update(usersTable)
    .set({ passwordHash: newHash })
    .where(eq(usersTable.id, req.userId!));

  req.log.info({ userId: req.userId }, "User changed password");
  res.json({ message: "تم تغيير كلمة المرور بنجاح" });
});

// ── DELETE /auth/me — delete account ─────────────────────────────────────────

router.delete("/auth/me", requireAuth, async (req: AuthRequest, res): Promise<void> => {
  const parsed = DeleteMeBody.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.message });
    return;
  }

  const { password } = parsed.data;

  const [user] = await db
    .select()
    .from(usersTable)
    .where(eq(usersTable.id, req.userId!));

  if (!user) {
    res.status(404).json({ error: "المستخدم غير موجود" });
    return;
  }

  const match = await bcrypt.compare(password, user.passwordHash);
  if (!match) {
    res.status(400).json({ error: "كلمة المرور غير صحيحة" });
    return;
  }

  await db.delete(usersTable).where(eq(usersTable.id, req.userId!));

  req.log.info({ userId: req.userId }, "User deleted account");
  res.json({ message: "تم حذف الحساب بنجاح" });
});

export default router;
