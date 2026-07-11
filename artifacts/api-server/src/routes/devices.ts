import { Router, type IRouter } from "express";
import { and, eq } from "drizzle-orm";
import { db, deviceTokensTable } from "@workspace/db";
import { requireAuth, type AuthRequest } from "../middlewares/auth";

const router: IRouter = Router();

const VALID_PLATFORMS = ["ios", "android", "web"] as const;
type Platform = (typeof VALID_PLATFORMS)[number];

function isValidPlatform(value: unknown): value is Platform {
  return typeof value === "string" && (VALID_PLATFORMS as readonly string[]).includes(value);
}

// ---------------------------------------------------------------------------
// POST /devices — register (or refresh) a device token for the current user.
// Re-registering an existing token reassigns it to the caller, which
// naturally handles a different user logging in on the same device.
// ---------------------------------------------------------------------------
router.post("/devices", requireAuth, async (req: AuthRequest, res): Promise<void> => {
  const userId = req.userId!;
  const { token, platform } = req.body ?? {};

  if (typeof token !== "string" || token.trim().length === 0) {
    res.status(400).json({ error: "token مطلوب" });
    return;
  }

  if (!isValidPlatform(platform)) {
    res.status(400).json({ error: "platform يجب أن يكون ios أو android أو web" });
    return;
  }

  const trimmedToken = token.trim();

  const [device] = await db
    .insert(deviceTokensTable)
    .values({ userId, token: trimmedToken, platform })
    .onConflictDoUpdate({
      target: deviceTokensTable.token,
      set: { userId, platform, lastSeenAt: new Date() },
    })
    .returning();

  res.status(201).json(serializeDevice(device));
});

// ---------------------------------------------------------------------------
// DELETE /devices/:token — unregister a device (e.g. on logout).
// Only removes the token if it belongs to the caller.
// ---------------------------------------------------------------------------
router.delete("/devices/:token", requireAuth, async (req: AuthRequest, res): Promise<void> => {
  const userId = req.userId!;
  const token = String(req.params.token ?? "");

  await db
    .delete(deviceTokensTable)
    .where(and(eq(deviceTokensTable.token, token), eq(deviceTokensTable.userId, userId)));

  res.status(204).send();
});

function serializeDevice(d: typeof deviceTokensTable.$inferSelect) {
  return {
    id: d.id,
    userId: d.userId,
    platform: d.platform,
    createdAt: d.createdAt.toISOString(),
    lastSeenAt: d.lastSeenAt.toISOString(),
  };
}

export default router;
