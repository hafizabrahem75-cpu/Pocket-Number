import { Router, type IRouter } from "express";
import { eq, and, or } from "drizzle-orm";
import { db, usersTable, friendshipsTable } from "@workspace/db";
import { requireAuth, type AuthRequest } from "../middlewares/auth";

const router: IRouter = Router();

/** Helper: build a public user object with a fixed friendshipStatus */
function publicUser(
  user: { id: number; pocketNumber: string; name: string; isVerified: boolean },
  friendshipStatus: "none" | "pending_sent" | "pending_received" | "accepted" = "none",
  friendshipId?: number,
) {
  return {
    id: user.id,
    pocketNumber: user.pocketNumber,
    name: user.name,
    isVerified: user.isVerified,
    friendshipStatus,
    ...(friendshipId !== undefined ? { friendshipId } : {}),
  };
}

// GET /friends — accepted friends list
router.get("/friends", requireAuth, async (req: AuthRequest, res): Promise<void> => {
  const userId = req.userId!;

  const rows = await db
    .select({
      friendshipId: friendshipsTable.id,
      since: friendshipsTable.updatedAt,
      requesterId: friendshipsTable.requesterId,
      addresseeId: friendshipsTable.addresseeId,
      friendId: usersTable.id,
      friendPocketNumber: usersTable.pocketNumber,
      friendName: usersTable.name,
      friendIsVerified: usersTable.isVerified,
    })
    .from(friendshipsTable)
    .innerJoin(
      usersTable,
      or(
        and(
          eq(friendshipsTable.requesterId, userId),
          eq(usersTable.id, friendshipsTable.addresseeId),
        ),
        and(
          eq(friendshipsTable.addresseeId, userId),
          eq(usersTable.id, friendshipsTable.requesterId),
        ),
      ),
    )
    .where(eq(friendshipsTable.status, "accepted"));

  const friends = rows.map((row) => ({
    friendshipId: row.friendshipId,
    since: row.since.toISOString(),
    user: publicUser(
      {
        id: row.friendId,
        pocketNumber: row.friendPocketNumber,
        name: row.friendName,
        isVerified: row.friendIsVerified,
      },
      "accepted",
      row.friendshipId,
    ),
  }));

  res.json(friends);
});

// GET /friends/requests/incoming
router.get(
  "/friends/requests/incoming",
  requireAuth,
  async (req: AuthRequest, res): Promise<void> => {
    const userId = req.userId!;

    const rows = await db
      .select({
        id: friendshipsTable.id,
        status: friendshipsTable.status,
        createdAt: friendshipsTable.createdAt,
        requesterId: usersTable.id,
        requesterPocketNumber: usersTable.pocketNumber,
        requesterName: usersTable.name,
        requesterIsVerified: usersTable.isVerified,
        addresseeId: friendshipsTable.addresseeId,
      })
      .from(friendshipsTable)
      .innerJoin(usersTable, eq(usersTable.id, friendshipsTable.requesterId))
      .where(
        and(eq(friendshipsTable.addresseeId, userId), eq(friendshipsTable.status, "pending")),
      );

    const requests = rows.map((row) => ({
      id: row.id,
      status: row.status,
      createdAt: row.createdAt.toISOString(),
      requester: publicUser(
        {
          id: row.requesterId,
          pocketNumber: row.requesterPocketNumber,
          name: row.requesterName,
          isVerified: row.requesterIsVerified,
        },
        "pending_sent",
        row.id,
      ),
      addressee: publicUser({ id: userId, pocketNumber: "", name: "", isVerified: true }),
    }));

    res.json(requests);
  },
);

// GET /friends/requests/outgoing
router.get(
  "/friends/requests/outgoing",
  requireAuth,
  async (req: AuthRequest, res): Promise<void> => {
    const userId = req.userId!;

    const rows = await db
      .select({
        id: friendshipsTable.id,
        status: friendshipsTable.status,
        createdAt: friendshipsTable.createdAt,
        addresseeId: usersTable.id,
        addresseePocketNumber: usersTable.pocketNumber,
        addresseeName: usersTable.name,
        addresseeIsVerified: usersTable.isVerified,
      })
      .from(friendshipsTable)
      .innerJoin(usersTable, eq(usersTable.id, friendshipsTable.addresseeId))
      .where(
        and(eq(friendshipsTable.requesterId, userId), eq(friendshipsTable.status, "pending")),
      );

    const requests = rows.map((row) => ({
      id: row.id,
      status: row.status,
      createdAt: row.createdAt.toISOString(),
      requester: publicUser({ id: userId, pocketNumber: "", name: "", isVerified: true }),
      addressee: publicUser(
        {
          id: row.addresseeId,
          pocketNumber: row.addresseePocketNumber,
          name: row.addresseeName,
          isVerified: row.addresseeIsVerified,
        },
        "pending_received",
        row.id,
      ),
    }));

    res.json(requests);
  },
);

// POST /friends/request — send a friend request
router.post("/friends/request", requireAuth, async (req: AuthRequest, res): Promise<void> => {
  const userId = req.userId!;
  const addresseeId = Number(req.body?.addresseeId);

  if (!addresseeId || isNaN(addresseeId)) {
    res.status(400).json({ error: "معرّف المستخدم غير صحيح" });
    return;
  }

  if (addresseeId === userId) {
    res.status(400).json({ error: "لا يمكنك إرسال طلب صداقة لنفسك" });
    return;
  }

  // Check target user exists
  const [addressee] = await db
    .select({ id: usersTable.id, pocketNumber: usersTable.pocketNumber, name: usersTable.name, isVerified: usersTable.isVerified })
    .from(usersTable)
    .where(eq(usersTable.id, addresseeId));

  if (!addressee) {
    res.status(404).json({ error: "المستخدم غير موجود" });
    return;
  }

  // Check for existing relationship
  const [existing] = await db
    .select()
    .from(friendshipsTable)
    .where(
      or(
        and(eq(friendshipsTable.requesterId, userId), eq(friendshipsTable.addresseeId, addresseeId)),
        and(eq(friendshipsTable.requesterId, addresseeId), eq(friendshipsTable.addresseeId, userId)),
      ),
    )
    .limit(1);

  if (existing) {
    if (existing.status === "accepted") {
      res.status(400).json({ error: "أنتما أصدقاء بالفعل" });
    } else if (existing.status === "pending") {
      res.status(400).json({ error: "طلب الصداقة موجود بالفعل" });
    } else {
      res.status(400).json({ error: "لا يمكن إرسال طلب صداقة في الوقت الحالي" });
    }
    return;
  }

  const [created] = await db
    .insert(friendshipsTable)
    .values({ requesterId: userId, addresseeId, status: "pending" })
    .returning();

  res.status(201).json({
    id: created.id,
    status: created.status,
    createdAt: created.createdAt.toISOString(),
    requester: publicUser({ id: userId, pocketNumber: "", name: "", isVerified: true }),
    addressee: publicUser(addressee, "pending_received", created.id),
  });
});

// POST /friends/requests/:id/accept
router.post(
  "/friends/requests/:id/accept",
  requireAuth,
  async (req: AuthRequest, res): Promise<void> => {
    const userId = req.userId!;
    const id = Number(req.params.id);

    const [friendship] = await db
      .select()
      .from(friendshipsTable)
      .where(and(eq(friendshipsTable.id, id), eq(friendshipsTable.addresseeId, userId), eq(friendshipsTable.status, "pending")));

    if (!friendship) {
      res.status(404).json({ error: "طلب الصداقة غير موجود" });
      return;
    }

    await db
      .update(friendshipsTable)
      .set({ status: "accepted", updatedAt: new Date() })
      .where(eq(friendshipsTable.id, id));

    res.json({ message: "تمت إضافة الصديق بنجاح" });
  },
);

// POST /friends/requests/:id/reject
router.post(
  "/friends/requests/:id/reject",
  requireAuth,
  async (req: AuthRequest, res): Promise<void> => {
    const userId = req.userId!;
    const id = Number(req.params.id);

    const [friendship] = await db
      .select()
      .from(friendshipsTable)
      .where(and(eq(friendshipsTable.id, id), eq(friendshipsTable.addresseeId, userId), eq(friendshipsTable.status, "pending")));

    if (!friendship) {
      res.status(404).json({ error: "طلب الصداقة غير موجود" });
      return;
    }

    await db.delete(friendshipsTable).where(eq(friendshipsTable.id, id));

    res.json({ message: "تم رفض طلب الصداقة" });
  },
);

// DELETE /friends/requests/:id — cancel outgoing
router.delete(
  "/friends/requests/:id",
  requireAuth,
  async (req: AuthRequest, res): Promise<void> => {
    const userId = req.userId!;
    const id = Number(req.params.id);

    const [friendship] = await db
      .select()
      .from(friendshipsTable)
      .where(and(eq(friendshipsTable.id, id), eq(friendshipsTable.requesterId, userId), eq(friendshipsTable.status, "pending")));

    if (!friendship) {
      res.status(404).json({ error: "طلب الصداقة غير موجود" });
      return;
    }

    await db.delete(friendshipsTable).where(eq(friendshipsTable.id, id));

    res.json({ message: "تم إلغاء طلب الصداقة" });
  },
);

export default router;
