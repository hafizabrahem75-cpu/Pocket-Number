import { Router, type IRouter } from "express";
import { eq, or, and } from "drizzle-orm";
import { db, usersTable, friendshipsTable } from "@workspace/db";
import { requireAuth, type AuthRequest } from "../middlewares/auth";

const router: IRouter = Router();

// POST /users/heartbeat — mark caller as online, update last_seen_at
router.post("/users/heartbeat", requireAuth, async (req: AuthRequest, res): Promise<void> => {
  await db
    .update(usersTable)
    .set({ isOnline: true, lastSeenAt: new Date() })
    .where(eq(usersTable.id, req.userId!));

  res.json({ message: "ok" });
});

// GET /users/search?q=710000001
router.get("/users/search", requireAuth, async (req: AuthRequest, res): Promise<void> => {
  const q = (req.query.q as string | undefined)?.trim().toUpperCase();

  if (!q) {
    res.status(400).json({ error: "يرجى إدخال رقم الهاتف للبحث" });
    return;
  }

  const [found] = await db
    .select({
      id: usersTable.id,
      pocketNumber: usersTable.pocketNumber,
      name: usersTable.name,
      isVerified: usersTable.isVerified,
      isOnline: usersTable.isOnline,
      lastSeenAt: usersTable.lastSeenAt,
    })
    .from(usersTable)
    .where(eq(usersTable.pocketNumber, q));

  if (!found) {
    res.status(404).json({ error: "لم يُعثر على أي مستخدم بهذا الرقم" });
    return;
  }

  const currentUserId = req.userId!;

  let friendshipStatus: "none" | "pending_sent" | "pending_received" | "accepted" = "none";
  let friendshipId: number | undefined;

  if (found.id !== currentUserId) {
    const [friendship] = await db
      .select()
      .from(friendshipsTable)
      .where(
        or(
          and(
            eq(friendshipsTable.requesterId, currentUserId),
            eq(friendshipsTable.addresseeId, found.id),
          ),
          and(
            eq(friendshipsTable.requesterId, found.id),
            eq(friendshipsTable.addresseeId, currentUserId),
          ),
        ),
      )
      .limit(1);

    if (friendship) {
      friendshipId = friendship.id;
      if (friendship.status === "accepted") {
        friendshipStatus = "accepted";
      } else if (friendship.status === "pending") {
        friendshipStatus =
          friendship.requesterId === currentUserId ? "pending_sent" : "pending_received";
      }
    }
  }

  res.json({
    id: found.id,
    pocketNumber: found.pocketNumber,
    name: found.name,
    isVerified: found.isVerified,
    isOnline: found.isOnline,
    lastSeenAt: found.lastSeenAt?.toISOString() ?? null,
    friendshipStatus,
    ...(friendshipId !== undefined ? { friendshipId } : {}),
  });
});

export default router;
