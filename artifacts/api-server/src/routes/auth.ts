import { Router, type IRouter } from "express";
import { eq, and, gt } from "drizzle-orm";
import bcrypt from "bcryptjs";
import { db, usersTable, otpCodesTable, pocketNumberCounterTable } from "@workspace/db";
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
} from "@workspace/api-zod";
import { signToken } from "../lib/jwt";
import { generateOtpCode, getOtpExpiry, sendOtpEmail } from "../lib/otp";
import { requireAuth, type AuthRequest } from "../middlewares/auth";

const router: IRouter = Router();

/**
 * Atomically increments and returns the next pocket number.
 */
async function getNextPocketNumber(): Promise<string> {
  // Ensure the counter row exists
  await db
    .insert(pocketNumberCounterTable)
    .values({ id: 1, lastNumber: 100000 })
    .onConflictDoNothing();

  const [updated] = await db
    .update(pocketNumberCounterTable)
    .set({ lastNumber: db.$count(pocketNumberCounterTable) })
    .returning();

  // Use raw SQL for atomic increment
  const result = await db.execute(
    `UPDATE pocket_number_counter SET last_number = last_number + 1 WHERE id = 1 RETURNING last_number`,
  );
  const lastNumber = (result as any).rows?.[0]?.last_number ?? 100001;
  return `PN-${lastNumber}`;
}

// POST /auth/register
router.post("/auth/register", async (req, res): Promise<void> => {
  const parsed = RegisterBody.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.message });
    return;
  }

  const { name, email, password } = parsed.data;
  const lowerEmail = email.toLowerCase().trim();

  // Check if email already exists
  const [existing] = await db
    .select({ id: usersTable.id })
    .from(usersTable)
    .where(eq(usersTable.email, lowerEmail));

  if (existing) {
    res.status(409).json({ error: "هذا البريد الإلكتروني مسجل مسبقاً" });
    return;
  }

  // Hash password
  const passwordHash = await bcrypt.hash(password, 12);

  // Get next pocket number (atomic)
  const rawResult = await db.execute(
    `INSERT INTO pocket_number_counter (id, last_number) VALUES (1, 100000) ON CONFLICT (id) DO UPDATE SET last_number = pocket_number_counter.last_number + 1 RETURNING last_number`,
  );
  const lastNumber = (rawResult as any).rows?.[0]?.last_number ?? 100001;
  const pocketNumber = `PN-${lastNumber}`;

  // Create user (unverified)
  await db.insert(usersTable).values({
    name: name.trim(),
    email: lowerEmail,
    passwordHash,
    pocketNumber,
    isVerified: false,
  });

  // Invalidate old OTPs for this email
  await db
    .update(otpCodesTable)
    .set({ used: true })
    .where(eq(otpCodesTable.email, lowerEmail));

  // Generate and save OTP
  const code = generateOtpCode();
  const expiresAt = getOtpExpiry();
  await db.insert(otpCodesTable).values({ email: lowerEmail, code, expiresAt });

  // Send OTP (currently logs in dev mode)
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

// POST /auth/verify-otp
router.post("/auth/verify-otp", async (req, res): Promise<void> => {
  const parsed = VerifyOtpBody.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.message });
    return;
  }

  const { email, code } = parsed.data;
  const lowerEmail = email.toLowerCase().trim();
  const now = new Date();

  // Find valid OTP
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

  // Mark OTP as used
  await db
    .update(otpCodesTable)
    .set({ used: true })
    .where(eq(otpCodesTable.id, otp.id));

  // Activate user
  const [user] = await db
    .update(usersTable)
    .set({ isVerified: true })
    .where(eq(usersTable.email, lowerEmail))
    .returning();

  if (!user) {
    res.status(400).json({ error: "المستخدم غير موجود" });
    return;
  }

  const token = signToken({ userId: user.id, email: user.email });

  req.log.info({ userId: user.id }, "User verified and logged in");
  res.json(
    VerifyOtpResponse.parse({
      token,
      user: {
        id: user.id,
        pocketNumber: user.pocketNumber,
        name: user.name,
        email: user.email,
        isVerified: user.isVerified,
        createdAt: user.createdAt.toISOString(),
      },
    }),
  );
});

// POST /auth/resend-otp
router.post("/auth/resend-otp", async (req, res): Promise<void> => {
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

  // Invalidate old OTPs
  await db
    .update(otpCodesTable)
    .set({ used: true })
    .where(eq(otpCodesTable.email, lowerEmail));

  // New OTP
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

// POST /auth/login
router.post("/auth/login", async (req, res): Promise<void> => {
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

  if (!user.isVerified) {
    res.status(403).json({ error: "يرجى تفعيل حسابك عبر رمز التحقق المرسل إلى بريدك الإلكتروني" });
    return;
  }

  const token = signToken({ userId: user.id, email: user.email });

  req.log.info({ userId: user.id }, "User logged in");
  res.json(
    LoginResponse.parse({
      token,
      user: {
        id: user.id,
        pocketNumber: user.pocketNumber,
        name: user.name,
        email: user.email,
        isVerified: user.isVerified,
        createdAt: user.createdAt.toISOString(),
      },
    }),
  );
});

// POST /auth/logout
router.post("/auth/logout", async (_req, res): Promise<void> => {
  // JWT is stateless — logout is handled client-side by discarding the token
  res.json(LogoutResponse.parse({ message: "تم تسجيل الخروج بنجاح" }));
});

// GET /auth/me
router.get("/auth/me", requireAuth, async (req: AuthRequest, res): Promise<void> => {
  const [user] = await db
    .select()
    .from(usersTable)
    .where(eq(usersTable.id, req.userId!));

  if (!user) {
    res.status(401).json({ error: "المستخدم غير موجود" });
    return;
  }

  res.json(
    GetMeResponse.parse({
      id: user.id,
      pocketNumber: user.pocketNumber,
      name: user.name,
      email: user.email,
      isVerified: user.isVerified,
      createdAt: user.createdAt.toISOString(),
    }),
  );
});

export default router;
