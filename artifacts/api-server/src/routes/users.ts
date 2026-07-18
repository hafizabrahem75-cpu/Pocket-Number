import { Router, type IRouter } from "express";
import { eq, or, and } from "drizzle-orm";
import { db, usersTable, friendshipsTable } from "@workspace/db";
import { requireAuth, type AuthRequest } from "../middlewares/auth";
import { normalizePhoneNumber } from "../lib/phone";

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
  const rawQ = (req.query.q as string | undefined)?.trim();

  if (!rawQ) {
    res.status(400).json({ error: "يرجى إدخال رقم الهاتف للبحث" });
    return;
  }

  // Normalize the input so that all of these reach the same record:
  //   +967764000001 | +967 764000001 | 967764000001 | 0764000001
  // Falls back to the raw value (uppercased) so bare PN-format strings
  // entered directly still work without conversion.
  const normalized = await normalizePhoneNumber(rawQ);
  const q = normalized?.canonical ?? rawQ.toUpperCase();

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

// GET /users/:id — public profile lookup by id (used to resolve call history peers)
router.get("/users/:id", requireAuth, async (req: AuthRequest, res): Promise<void> => {
  const id = Number(req.params.id);
  if (!Number.isInteger(id) || id <= 0) {
    res.status(400).json({ error: "معرّف المستخدم غير صحيح" });
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
    .where(eq(usersTable.id, id));

  if (!found) {
    res.status(404).json({ error: "لم يُعثر على هذا المستخدم" });
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
