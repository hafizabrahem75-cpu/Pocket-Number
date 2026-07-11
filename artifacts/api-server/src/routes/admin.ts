import { Router, type IRouter } from "express";
import { eq, desc, lt } from "drizzle-orm";
import {
  db,
  usersTable,
  POCKET_NUMBER_COUNTRY_CODE_KEY,
  POCKET_NUMBER_PREFIX_KEY,
} from "@workspace/db";
import { getPocketNumberConfig, setSetting } from "../lib/settings";
import { requireAuth, requireAdmin, type AuthRequest } from "../middlewares/auth";

const router: IRouter = Router();

// Every /admin route requires a valid session AND the "admin" role.
router.use("/admin", requireAuth, requireAdmin);

const PAGE_SIZE = 50;

function parsePositiveInt(raw: string | string[] | undefined): number | null {
  if (!raw || Array.isArray(raw)) return null;
  const n = Number(raw);
  return Number.isInteger(n) && n > 0 ? n : null;
}

function serializeAdminUser(u: typeof usersTable.$inferSelect) {
  return {
    id: u.id,
    pocketNumber: u.pocketNumber,
    name: u.name,
    email: u.email,
    role: u.role,
    isVerified: u.isVerified,
    isOnline: u.isOnline,
    isSuspended: u.isSuspended,
    lastSeenAt: u.lastSeenAt ? u.lastSeenAt.toISOString() : null,
    createdAt: u.createdAt.toISOString(),
  };
}

// ---------------------------------------------------------------------------
// Settings (Pocket Number country code / prefix)
// ---------------------------------------------------------------------------

// GET /admin/settings/pocket-number — current country code + prefix
router.get("/admin/settings/pocket-number", async (_req, res): Promise<void> => {
  const config = await getPocketNumberConfig();
  res.json(config);
});

// PATCH /admin/settings/pocket-number — update country code and/or prefix.
// Only affects pocket numbers generated after this change; existing users
// keep their current numbers.
router.patch("/admin/settings/pocket-number", async (req, res): Promise<void> => {
  const { countryCode, prefix } = req.body ?? {};

  if (countryCode !== undefined) {
    if (typeof countryCode !== "string" || !/^\+\d{1,4}$/.test(countryCode.trim())) {
      res.status(400).json({ error: "countryCode must look like '+967'" });
      return;
    }
    await setSetting(POCKET_NUMBER_COUNTRY_CODE_KEY, countryCode.trim());
  }

  if (prefix !== undefined) {
    if (typeof prefix !== "string" || !/^\d{1,4}$/.test(prefix.trim())) {
      res.status(400).json({ error: "prefix must be 1-4 digits" });
      return;
    }
    await setSetting(POCKET_NUMBER_PREFIX_KEY, prefix.trim());
  }

  const config = await getPocketNumberConfig();
  res.json(config);
});

// ---------------------------------------------------------------------------
// Users
// ---------------------------------------------------------------------------

// GET /admin/users — paginated user list, newest-first
router.get("/admin/users", async (req, res): Promise<void> => {
  const beforeId = parsePositiveInt(req.query.before as string | undefined);

  const users = await db
    .select()
    .from(usersTable)
    .where(beforeId ? lt(usersTable.id, beforeId) : undefined)
    .orderBy(desc(usersTable.id))
    .limit(PAGE_SIZE);

  res.json({
    users: users.map(serializeAdminUser),
    hasMore: users.length === PAGE_SIZE,
    nextCursor: users.length === PAGE_SIZE ? users[users.length - 1].id : null,
  });
});

// GET /admin/users/:id — user details
router.get("/admin/users/:id", async (req, res): Promise<void> => {
  const id = parsePositiveInt(req.params.id);
  if (!id) {
    res.status(400).json({ error: "Invalid user id" });
    return;
  }

  const [user] = await db.select().from(usersTable).where(eq(usersTable.id, id));
  if (!user) {
    res.status(404).json({ error: "User not found" });
    return;
  }

  res.json(serializeAdminUser(user));
});

// PATCH /admin/users/:id/suspend — lock the account (blocks future logins)
router.patch("/admin/users/:id/suspend", async (req: AuthRequest, res): Promise<void> => {
  const id = parsePositiveInt(req.params.id);
  if (!id) {
    res.status(400).json({ error: "Invalid user id" });
    return;
  }

  if (id === req.userId) {
    res.status(400).json({ error: "You cannot suspend your own account" });
    return;
  }

  const [user] = await db
    .update(usersTable)
    .set({ isSuspended: true })
    .where(eq(usersTable.id, id))
    .returning();

  if (!user) {
    res.status(404).json({ error: "User not found" });
    return;
  }

  res.json(serializeAdminUser(user));
});

// PATCH /admin/users/:id/restore — lift a suspension
router.patch("/admin/users/:id/restore", async (_req, res): Promise<void> => {
  const id = parsePositiveInt(_req.params.id);
  if (!id) {
    res.status(400).json({ error: "Invalid user id" });
    return;
  }

  const [user] = await db
    .update(usersTable)
    .set({ isSuspended: false })
    .where(eq(usersTable.id, id))
    .returning();

  if (!user) {
    res.status(404).json({ error: "User not found" });
    return;
  }

  res.json(serializeAdminUser(user));
});

export default router;
