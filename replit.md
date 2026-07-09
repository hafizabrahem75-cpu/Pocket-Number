# Pocket Number

نظام رقم افتراضي داخلي عبر الإنترنت — كل مستخدم يحصل على رقم خاص مثل PN-100001.

## Run & Operate

- `pnpm --filter @workspace/pocket-number run dev` — run the frontend (Vite, port auto-assigned)
- `pnpm --filter @workspace/api-server run dev` — run the API server (port 8080)
- `pnpm run typecheck` — full typecheck across all packages
- `pnpm run build` — typecheck + build all packages
- `pnpm --filter @workspace/api-spec run codegen` — regenerate API hooks and Zod schemas from the OpenAPI spec
- `pnpm --filter @workspace/db run push` — push DB schema changes (dev only)
- Required env: `DATABASE_URL` — Postgres connection string
- Required env: `SESSION_SECRET` — used as JWT signing secret

## Stack

- pnpm workspaces, Node.js 24, TypeScript 5.9
- Frontend: React + Vite + Tailwind CSS (Arabic RTL, Cairo font)
- API: Express 5
- DB: PostgreSQL + Drizzle ORM
- Auth: JWT (signed with SESSION_SECRET), stored in localStorage
- Passwords: bcrypt (cost factor 12)
- OTP: 6-digit, cryptographically secure (crypto.randomInt), 10-minute expiry
- Validation: Zod (zod/v4), drizzle-zod
- API codegen: Orval (from OpenAPI spec)
- Build: esbuild (CJS bundle)

## Where things live

- `lib/api-spec/openapi.yaml` — API contract source of truth
- `lib/db/src/schema/users.ts` — users, otp_codes, pocket_number_counter tables
- `artifacts/api-server/src/routes/auth.ts` — all auth routes
- `artifacts/api-server/src/lib/jwt.ts` — JWT sign/verify
- `artifacts/api-server/src/lib/otp.ts` — OTP generation & sending
- `artifacts/api-server/src/middlewares/auth.ts` — requireAuth middleware
- `artifacts/pocket-number/src/contexts/AuthContext.tsx` — global auth state + setAuthTokenGetter
- `artifacts/pocket-number/src/pages/` — Splash, Register, VerifyOtp, Login, Profile, Settings

## Architecture decisions

- **Pocket numbers** use a counter table (`pocket_number_counter`) with atomic SQL `UPDATE ... RETURNING` to avoid race conditions. Format: `PN-{lastNumber}` starting at PN-100001.
- **JWT stored in localStorage** — acceptable for MVP; future phases should migrate to HttpOnly cookies.
- **OTP NOT logged** in production — dev mode writes to stderr only. Replace `sendOtpEmail` in `otp.ts` with a real email provider (Resend, SendGrid) in Phase 2.
- **No `format: email` in OpenAPI spec** — Orval generates `zod.email()` which conflicts with the current zod setup. Use `type: string` with pattern validation instead.
- **setAuthTokenGetter** registered globally in AuthContext so all API hooks automatically send Authorization headers — no need to pass `request` option per-call.

## Product

**Phase 1 (complete):**
- User registration with email + password
- OTP email verification (6-digit, 10-min expiry, cryptographically secure)
- Auto-assigned pocket number (PN-100001 format)
- Login / logout with JWT
- Profile page showing name, pocket number, email, verification status
- Settings page with logout

**Planned phases:**
- Phase 2: Real email sending (Resend/SendGrid), rate limiting on auth endpoints
- Phase 3: Internal messaging between pocket numbers
- Phase 4: Voice/video calls
- Capacitor: convert to Android APK when core features are stable

## User preferences

- Arabic-first UI with full RTL support
- Mobile-first (max-width 428px), centered on desktop
- No emojis in UI
- Cairo font from Google Fonts
- Keep dependencies minimal

## Gotchas

- After any `lib/*` schema change, run `pnpm run typecheck:libs` before checking artifact packages
- Always run codegen after changing `openapi.yaml`: `pnpm --filter @workspace/api-spec run codegen`
- `pnpm --filter @workspace/db run push` applies schema to dev DB only — production schema is managed by Replit Publish flow

## Pointers

- See the `pnpm-workspace` skill for workspace structure, TypeScript setup, and package details
