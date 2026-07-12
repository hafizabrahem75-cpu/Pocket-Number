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
- Optional env (Android push, not yet configured): `FCM_PROJECT_ID`, `FCM_CLIENT_EMAIL`, `FCM_PRIVATE_KEY` — Firebase service-account credentials. Until all three are set, push notifications stay in their current log-only mode; see "Push notifications" below.

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
- `lib/db/src/schema/users.ts` — users, otp_codes, pocket_number_counter, contacts, friendships tables
- `artifacts/api-server/src/routes/auth.ts` — all auth routes
- `artifacts/api-server/src/routes/contacts.ts` — contacts CRUD routes
- `artifacts/api-server/src/lib/jwt.ts` — JWT sign/verify
- `artifacts/api-server/src/lib/otp.ts` — OTP generation & sending
- `artifacts/api-server/src/middlewares/auth.ts` — requireAuth middleware
- `artifacts/pocket-number/src/contexts/AuthContext.tsx` — global auth state + setAuthTokenGetter
- `artifacts/pocket-number/src/pages/` — Splash, Register, VerifyOtp, Login, Profile, Settings

## Contacts system design

- كل مستخدم لديه **دفتر جهات اتصال خاص به** — مستقل تماماً عن بقية المستخدمين.
- الاسم الحقيقي والبريد الإلكتروني محفوظان في حساب المالك فقط، ولا يُشاركان تلقائياً.
- عند إضافة مستخدم آخر عبر Pocket Number، يمكن حفظه **بأي اسم مخصص** في دفتر الجهات الخاص بك.
- الاسم المخصص **لا يُغيّر** اسم صاحب الحساب الحقيقي، ولا يظهر لأي مستخدم آخر.
- هذا التصميم هو الأساس الذي تُبنى عليه جميع المراحل القادمة (المراسلة، المكالمات، إلخ).

## Architecture decisions

- **Pocket numbers** use a counter table (`pocket_number_counter`) with atomic SQL `UPDATE ... RETURNING` to avoid race conditions. Format: `PN-{lastNumber}` starting at PN-100001. The column is `text` with a UNIQUE constraint — ready to hold any future phone-like format without schema changes.
- **Contacts system** uses a dedicated `contacts` table (owner_id → contact_user_id → local_name) separate from `friendships`. Contacts are unilateral (no approval needed). The `local_name` is private to the owner and never visible to the contact or anyone else. Uniqueness is enforced at DB level (`UNIQUE(owner_id, contact_user_id)`). Duplicate insert returns 409. All mutation routes include `ownerId` in both the pre-check and the mutation WHERE clause (defense-in-depth).
- **JWT stored in localStorage** — acceptable for MVP; future phases should migrate to HttpOnly cookies.
- **OTP NOT logged** in production — dev mode writes to stderr only. Replace `sendOtpEmail` in `otp.ts` with a real email provider (Resend, SendGrid) in Phase 2.
- **No `format: email` in OpenAPI spec** — Orval generates `zod.email()` which conflicts with the current zod setup. Use `type: string` with pattern validation instead.
- **setAuthTokenGetter** registered globally in AuthContext so all API hooks automatically send Authorization headers — no need to pass `request` option per-call.

## Messaging system (Phase 3 backend — complete)

- `lib/db/src/schema/messages.ts` — `messages` table
- `artifacts/api-server/src/routes/messages.ts` — all messaging routes

### DB schema — `messages` table
- `sender_id` / `recipient_id` → FK to `users.id` (cascade delete)
- `content` — plaintext Phase 1; reserved for ciphertext in Phase 2 (E2EE)
- `content_iv`, `content_tag` — nullable; AES-GCM IV + auth-tag for Phase 2
- `sender_public_key` — nullable; X25519 ephemeral key for Double Ratchet (Phase 2)
- `content_type` — MIME hint, defaults `text/plain`; reserved for binary types
- `status` — enum `sent | delivered | read`; forward-only state machine
- `deleted_at` — soft-delete (sender only, before message is read)
- Indexes on `(sender_id, recipient_id, created_at)`, `(recipient_id, created_at)`, `(recipient_id, status)`

### API endpoints
| Method | Path | Auth | Description |
|--------|------|------|-------------|
| POST | `/api/messages` | ✓ | Send a message |
| GET | `/api/messages/inbox` | ✓ | All conversations (latest msg + unread count per peer) |
| GET | `/api/messages/conversation?recipientId=X&before=Y` | ✓ | Paginated thread (50/page, cursor-based) |
| PATCH | `/api/messages/:id/status` | ✓ | Advance status: delivered → read (recipient only) |
| DELETE | `/api/messages/:id` | ✓ | Soft-delete (sender only, only if not yet read) |

### E2EE readiness
No schema migration needed to add E2EE: the columns (`content_iv`, `content_tag`, `sender_public_key`) are already there, nullable for Phase 1.

## Push notifications (Android prep — backend only, no Android app yet)

- `lib/db/src/schema/device-tokens.ts` — `device_tokens` table (`userId`, `token` unique, `platform` enum `ios|android|web`)
- `artifacts/api-server/src/routes/devices.ts` — `POST /api/devices` (register/refresh a token), `DELETE /api/devices/:token` (unregister)
- `artifacts/api-server/src/lib/notificationEvents.ts` — fire-and-forget hooks already wired into the message and call routes (`notifyNewMessage`, `notifyIncomingCall`); do not need to change when a push provider is added
- `artifacts/api-server/src/lib/notifications.ts` — `notifyUser` looks up a user's devices and dispatches; log-only when FCM isn't configured (true today)
- `artifacts/api-server/src/lib/fcm.ts` — Firebase Cloud Messaging client, Android-only for now. Reads `FCM_PROJECT_ID`/`FCM_CLIENT_EMAIL`/`FCM_PRIVATE_KEY` from env; `isFcmConfigured()` guards every call site so it's a total no-op without those set. `firebase-admin` is installed as a dependency of `artifacts/api-server`.
- **What's ready today:** device token registration/unregistration API, notification event hooks on new messages and incoming calls, an FCM dispatch path that activates automatically once credentials exist, and automatic pruning of tokens FCM reports as invalid.
- **What's still needed before real push works:** an actual Firebase project + service-account credentials (set as the three env vars above), the Capacitor/Android wrapper to obtain and register real device tokens, and a UI notification-permission prompt. None of that exists yet — this phase only prepared the backend.

## Product

**Phase 1 (complete):**
- User registration with email + password
- OTP email verification (6-digit, 10-min expiry, cryptographically secure)
- Auto-assigned pocket number (PN-100001 format)
- Login / logout with JWT
- Profile page showing name, pocket number, email, verification status
- Settings page with logout

**Phase 3 backend (complete):**
- Direct messaging backend (send, inbox, conversation thread, status updates, soft-delete)
- E2EE-ready schema (no migration needed to add encryption in Phase 2)

**Planned phases:**
- Phase 2: Real email sending (Resend/SendGrid), rate limiting on auth endpoints
- Phase 3 frontend: Messaging UI (inbox + conversation views)
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
