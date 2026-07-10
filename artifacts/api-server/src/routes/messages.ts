import { Router, type IRouter } from "express";
import { eq, and, or, desc, lt, gt, sql, inArray } from "drizzle-orm";
import { db, usersTable, messagesTable } from "@workspace/db";
import { requireAuth, type AuthRequest } from "../middlewares/auth";

const router: IRouter = Router();

const CONTENT_MAX = 10_000; // chars — same limit applies to ciphertext in Phase 2
const PAGE_SIZE = 50;

/** Parse a positive integer path / query param, or return null. */
function parsePositiveInt(raw: string | undefined): number | null {
  if (!raw) return null;
  const n = Number(raw);
  return Number.isInteger(n) && n > 0 ? n : null;
}

// ---------------------------------------------------------------------------
// POST /messages — send a message to another user
// ---------------------------------------------------------------------------
router.post("/messages", requireAuth, async (req: AuthRequest, res): Promise<void> => {
  const senderId = req.userId!;
  const { recipientId, content, contentType, contentIv, contentTag, senderPublicKey } = req.body ?? {};

  const parsedRecipientId = parsePositiveInt(String(recipientId ?? ""));
  if (!parsedRecipientId) {
    res.status(400).json({ error: "recipientId يجب أن يكون رقماً صحيحاً موجباً" });
    return;
  }

  if (parsedRecipientId === senderId) {
    res.status(400).json({ error: "لا يمكنك إرسال رسالة إلى نفسك" });
    return;
  }

  if (typeof content !== "string" || content.trim().length === 0) {
    res.status(400).json({ error: "محتوى الرسالة مطلوب" });
    return;
  }

  if (content.length > CONTENT_MAX) {
    res.status(400).json({ error: `الرسالة تتجاوز الحد الأقصى البالغ ${CONTENT_MAX} حرفاً` });
    return;
  }

  // Verify recipient exists
  const [recipient] = await db
    .select({ id: usersTable.id })
    .from(usersTable)
    .where(eq(usersTable.id, parsedRecipientId));

  if (!recipient) {
    res.status(404).json({ error: "المستخدم المستلم غير موجود" });
    return;
  }

  const [message] = await db
    .insert(messagesTable)
    .values({
      senderId,
      recipientId: parsedRecipientId,
      content: content.trim(),
      contentType: typeof contentType === "string" ? contentType : "text/plain",
      contentIv: typeof contentIv === "string" ? contentIv : null,
      contentTag: typeof contentTag === "string" ? contentTag : null,
      senderPublicKey: typeof senderPublicKey === "string" ? senderPublicKey : null,
      status: "sent",
    })
    .returning();

  res.status(201).json(serializeMessage(message));
});

// ---------------------------------------------------------------------------
// GET /messages/conversation?recipientId=X — paginated conversation thread
// ---------------------------------------------------------------------------
router.get(
  "/messages/conversation",
  requireAuth,
  async (req: AuthRequest, res): Promise<void> => {
    const myId = req.userId!;
    const otherId = parsePositiveInt(req.query.recipientId as string | undefined);

    if (!otherId) {
      res.status(400).json({ error: "recipientId غير صحيح" });
      return;
    }

    // Cursor-based pagination: ?before=<messageId> for older pages
    const beforeId = parsePositiveInt(req.query.before as string | undefined);

    const messages = await db
      .select()
      .from(messagesTable)
      .where(
        and(
          or(
            and(eq(messagesTable.senderId, myId), eq(messagesTable.recipientId, otherId)),
            and(eq(messagesTable.senderId, otherId), eq(messagesTable.recipientId, myId)),
          ),
          // Only non-deleted messages
          sql`${messagesTable.deletedAt} IS NULL`,
          // Pagination cursor
          beforeId ? lt(messagesTable.id, beforeId) : undefined,
        ),
      )
      .orderBy(desc(messagesTable.id))
      .limit(PAGE_SIZE);

    // Mark only the `sent` messages from the other user ON THIS PAGE as delivered.
    // Scoping to explicit IDs prevents advancing status on messages outside the
    // current cursor window (i.e. newer messages the caller hasn't seen yet).
    // Soft-deleted rows are already excluded by the query above (deletedAt IS NULL).
    const undeliveredIds = messages
      .filter((m) => m.senderId === otherId && m.status === "sent" && !m.deletedAt)
      .map((m) => m.id);

    if (undeliveredIds.length > 0) {
      await db
        .update(messagesTable)
        .set({ status: "delivered", updatedAt: new Date() })
        .where(
          and(
            eq(messagesTable.recipientId, myId),
            inArray(messagesTable.id, undeliveredIds),
          ),
        );

      // Reflect the new status in-memory so the response is consistent
      const now = new Date();
      for (const m of messages) {
        if (undeliveredIds.includes(m.id)) {
          m.status = "delivered";
          m.updatedAt = now;
        }
      }
    }

    res.json({
      messages: messages.map(serializeMessage).reverse(), // return oldest-first
      hasMore: messages.length === PAGE_SIZE,
      nextCursor: messages.length === PAGE_SIZE ? messages[messages.length - 1].id : null,
    });
  },
);

// ---------------------------------------------------------------------------
// GET /messages/inbox — summary of all conversations (latest message per peer)
// ---------------------------------------------------------------------------
router.get("/messages/inbox", requireAuth, async (req: AuthRequest, res): Promise<void> => {
  const myId = req.userId!;

  // Latest message per conversation partner, using a window function
  const rows = await db.execute(sql`
    WITH ranked AS (
      SELECT
        m.*,
        CASE
          WHEN m.sender_id = ${myId} THEN m.recipient_id
          ELSE m.sender_id
        END AS peer_id,
        ROW_NUMBER() OVER (
          PARTITION BY
            CASE WHEN m.sender_id = ${myId} THEN m.recipient_id ELSE m.sender_id END
          ORDER BY m.id DESC
        ) AS rn
      FROM messages m
      WHERE
        (m.sender_id = ${myId} OR m.recipient_id = ${myId})
        AND m.deleted_at IS NULL
    )
    SELECT
      r.id,
      r.sender_id,
      r.recipient_id,
      r.content,
      r.content_type,
      r.content_iv,
      r.content_tag,
      r.sender_public_key,
      r.status,
      r.created_at,
      r.updated_at,
      r.peer_id,
      u.pocket_number AS peer_pocket_number,
      u.name         AS peer_name,
      u.is_verified  AS peer_is_verified,
      (
        SELECT COUNT(*) FROM messages unread
        WHERE unread.recipient_id = ${myId}
          AND unread.sender_id = r.peer_id
          AND unread.status IN ('sent', 'delivered')
          AND unread.deleted_at IS NULL
      ) AS unread_count
    FROM ranked r
    JOIN users u ON u.id = r.peer_id
    WHERE r.rn = 1
    ORDER BY r.id DESC
  `);

  res.json({
    conversations: (rows.rows as any[]).map((row) => ({
      peerId: row.peer_id,
      peerPocketNumber: row.peer_pocket_number,
      peerName: row.peer_name,
      peerIsVerified: row.peer_is_verified,
      unreadCount: Number(row.unread_count),
      lastMessage: {
        id: row.id,
        senderId: row.sender_id,
        recipientId: row.recipient_id,
        content: row.content,
        contentType: row.content_type,
        status: row.status,
        createdAt: new Date(row.created_at).toISOString(),
        updatedAt: new Date(row.updated_at).toISOString(),
      },
    })),
  });
});

// ---------------------------------------------------------------------------
// PATCH /messages/:id/status — advance status (delivered → read)
// Only the recipient may call this; only forward transitions are allowed.
// ---------------------------------------------------------------------------
router.patch(
  "/messages/:id/status",
  requireAuth,
  async (req: AuthRequest, res): Promise<void> => {
    const myId = req.userId!;
    const msgId = parsePositiveInt(String(req.params.id ?? ""));

    if (!msgId) {
      res.status(400).json({ error: "معرّف الرسالة غير صحيح" });
      return;
    }

    const { status: newStatus } = req.body ?? {};
    if (newStatus !== "delivered" && newStatus !== "read") {
      res.status(400).json({ error: "الحالة يجب أن تكون delivered أو read" });
      return;
    }

    // Fetch message — recipient-only check (defence-in-depth)
    const [msg] = await db
      .select()
      .from(messagesTable)
      .where(and(eq(messagesTable.id, msgId), eq(messagesTable.recipientId, myId)));

    if (!msg) {
      res.status(404).json({ error: "الرسالة غير موجودة أو غير مصرّح لك بتعديلها" });
      return;
    }

    // Enforce forward-only state machine: sent → delivered → read
    const ORDER = { sent: 0, delivered: 1, read: 2 } as const;
    type StatusKey = keyof typeof ORDER;
    if (ORDER[newStatus as StatusKey] <= ORDER[msg.status as StatusKey]) {
      res.status(409).json({ error: "لا يمكن الرجوع إلى حالة سابقة" });
      return;
    }

    const [updated] = await db
      .update(messagesTable)
      .set({ status: newStatus, updatedAt: new Date() })
      .where(and(eq(messagesTable.id, msgId), eq(messagesTable.recipientId, myId)))
      .returning();

    res.json(serializeMessage(updated));
  },
);

// ---------------------------------------------------------------------------
// DELETE /messages/:id — soft-delete (sender only, only if not yet read)
// ---------------------------------------------------------------------------
router.delete(
  "/messages/:id",
  requireAuth,
  async (req: AuthRequest, res): Promise<void> => {
    const myId = req.userId!;
    const msgId = parsePositiveInt(String(req.params.id ?? ""));

    if (!msgId) {
      res.status(400).json({ error: "معرّف الرسالة غير صحيح" });
      return;
    }

    const [msg] = await db
      .select()
      .from(messagesTable)
      .where(and(eq(messagesTable.id, msgId), eq(messagesTable.senderId, myId)));

    if (!msg) {
      res.status(404).json({ error: "الرسالة غير موجودة أو غير مصرّح لك بحذفها" });
      return;
    }

    if (msg.status === "read") {
      res.status(409).json({ error: "لا يمكن حذف رسالة قرأها المستلم بالفعل" });
      return;
    }

    if (msg.deletedAt) {
      res.status(409).json({ error: "الرسالة محذوفة بالفعل" });
      return;
    }

    await db
      .update(messagesTable)
      .set({ deletedAt: new Date(), updatedAt: new Date() })
      .where(and(eq(messagesTable.id, msgId), eq(messagesTable.senderId, myId)));

    res.json({ message: "تم حذف الرسالة" });
  },
);

// ---------------------------------------------------------------------------
// Shared serializer
// ---------------------------------------------------------------------------
function serializeMessage(m: typeof messagesTable.$inferSelect) {
  return {
    id: m.id,
    senderId: m.senderId,
    recipientId: m.recipientId,
    content: m.content,
    contentType: m.contentType,
    // E2EE fields — null in Phase 1
    contentIv: m.contentIv ?? null,
    contentTag: m.contentTag ?? null,
    senderPublicKey: m.senderPublicKey ?? null,
    status: m.status,
    createdAt: m.createdAt.toISOString(),
    updatedAt: m.updatedAt.toISOString(),
    deletedAt: m.deletedAt ? m.deletedAt.toISOString() : null,
  };
}

export default router;
