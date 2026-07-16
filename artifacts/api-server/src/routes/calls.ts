import { Router, type IRouter } from "express";
import { eq, and, or, desc, lt, inArray } from "drizzle-orm";
import { db, usersTable, callsTable } from "@workspace/db";
import { requireAuth, type AuthRequest } from "../middlewares/auth";
import { notifyIncomingCall } from "../lib/notificationEvents";

const router: IRouter = Router();

const PAGE_SIZE = 50;

/** Parse a positive integer path / query param, or return null. */
function parsePositiveInt(raw: string | undefined): number | null {
  if (!raw) return null;
  const n = Number(raw);
  return Number.isInteger(n) && n > 0 ? n : null;
}

// Forward-only lifecycle: ringing -> {ongoing, missed, declined}; ongoing -> ended
const ALLOWED_TRANSITIONS: Record<string, string[]> = {
  ringing: ["ongoing", "missed", "declined"],
  ongoing: ["ended"],
  ended: [],
  missed: [],
  declined: [],
};

const TERMINAL_STATUSES = new Set(["ended", "missed", "declined"]);

// ---------------------------------------------------------------------------
// POST /calls — start a call (caller initiates)
// ---------------------------------------------------------------------------
router.post("/calls", requireAuth, async (req: AuthRequest, res): Promise<void> => {
  const callerId = req.userId!;
  const { receiverId } = req.body ?? {};

  const parsedReceiverId = parsePositiveInt(String(receiverId ?? ""));
  if (!parsedReceiverId) {
    res.status(400).json({ error: "receiverId يجب أن يكون رقماً صحيحاً موجباً" });
    return;
  }

  if (parsedReceiverId === callerId) {
    res.status(400).json({ error: "لا يمكنك الاتصال بنفسك" });
    return;
  }

  const [receiver] = await db
    .select({ id: usersTable.id })
    .from(usersTable)
    .where(eq(usersTable.id, parsedReceiverId));

  if (!receiver) {
    res.status(404).json({ error: "المستخدم المستقبل غير موجود" });
    return;
  }

  // ── Busy guard ─────────────────────────────────────────────────────────────
  // Reject the new call if either participant is already in an active call
  // (ringing or ongoing).  Checking both directions (caller/receiver columns)
  // handles the case where a user initiated or received the previous call.
  const ACTIVE_STATUSES = ["ringing", "ongoing"] as const;

  const [receiverBusy] = await db
    .select({ id: callsTable.id })
    .from(callsTable)
    .where(
      and(
        or(eq(callsTable.callerId, parsedReceiverId), eq(callsTable.receiverId, parsedReceiverId)),
        inArray(callsTable.status, [...ACTIVE_STATUSES]),
      ),
    )
    .limit(1);

  if (receiverBusy) {
    res.status(409).json({ error: "المستخدم المطلوب في مكالمة أخرى حالياً" });
    return;
  }

  const [callerBusy] = await db
    .select({ id: callsTable.id })
    .from(callsTable)
    .where(
      and(
        or(eq(callsTable.callerId, callerId), eq(callsTable.receiverId, callerId)),
        inArray(callsTable.status, [...ACTIVE_STATUSES]),
      ),
    )
    .limit(1);

  if (callerBusy) {
    res.status(409).json({ error: "أنت في مكالمة أخرى بالفعل" });
    return;
  }
  // ──────────────────────────────────────────────────────────────────────────

  const [call] = await db
    .insert(callsTable)
    .values({
      callerId,
      receiverId: parsedReceiverId,
      status: "ringing",
    })
    .returning();

  void notifyIncomingCall({
    callId: call.id,
    callerId,
    receiverId: parsedReceiverId,
  });

  res.status(201).json(serializeCall(call));
});

// ---------------------------------------------------------------------------
// PATCH /calls/:id/status — advance call status
// Only the caller or receiver of the call may update it.
// ---------------------------------------------------------------------------
router.patch(
  "/calls/:id/status",
  requireAuth,
  async (req: AuthRequest, res): Promise<void> => {
    const myId = req.userId!;
    const callId = parsePositiveInt(String(req.params.id ?? ""));

    if (!callId) {
      res.status(400).json({ error: "معرّف المكالمة غير صحيح" });
      return;
    }

    const { status: newStatus } = req.body ?? {};
    const VALID_STATUSES = ["ongoing", "ended", "missed", "declined"];
    if (typeof newStatus !== "string" || !VALID_STATUSES.includes(newStatus)) {
      res.status(400).json({ error: "الحالة يجب أن تكون ongoing أو ended أو missed أو declined" });
      return;
    }

    // Participant-only check (caller or receiver), defence-in-depth
    const [call] = await db
      .select()
      .from(callsTable)
      .where(
        and(
          eq(callsTable.id, callId),
          or(eq(callsTable.callerId, myId), eq(callsTable.receiverId, myId)),
        ),
      );

    if (!call) {
      res.status(404).json({ error: "المكالمة غير موجودة أو غير مصرّح لك بتعديلها" });
      return;
    }

    const allowed = ALLOWED_TRANSITIONS[call.status] ?? [];
    if (!allowed.includes(newStatus)) {
      res.status(409).json({ error: `لا يمكن الانتقال من ${call.status} إلى ${newStatus}` });
      return;
    }

    const nextStatus = newStatus as "ongoing" | "ended" | "missed" | "declined";

    const [updated] = await db
      .update(callsTable)
      .set({
        status: nextStatus,
        endedAt: TERMINAL_STATUSES.has(nextStatus) ? new Date() : call.endedAt,
      })
      .where(
        and(
          eq(callsTable.id, callId),
          or(eq(callsTable.callerId, myId), eq(callsTable.receiverId, myId)),
        ),
      )
      .returning();

    res.json(serializeCall(updated));
  },
);

// ---------------------------------------------------------------------------
// GET /calls/history — paginated call history (as caller or receiver)
// ---------------------------------------------------------------------------
router.get("/calls/history", requireAuth, async (req: AuthRequest, res): Promise<void> => {
  const myId = req.userId!;

  // Cursor-based pagination: ?before=<callId> for older pages
  const beforeId = parsePositiveInt(req.query.before as string | undefined);

  const calls = await db
    .select()
    .from(callsTable)
    .where(
      and(
        or(eq(callsTable.callerId, myId), eq(callsTable.receiverId, myId)),
        beforeId ? lt(callsTable.id, beforeId) : undefined,
      ),
    )
    .orderBy(desc(callsTable.id))
    .limit(PAGE_SIZE);

  res.json({
    calls: calls.map(serializeCall),
    hasMore: calls.length === PAGE_SIZE,
    nextCursor: calls.length === PAGE_SIZE ? calls[calls.length - 1].id : null,
  });
});

// ---------------------------------------------------------------------------
// Shared serializer
// ---------------------------------------------------------------------------
function serializeCall(c: typeof callsTable.$inferSelect) {
  return {
    id: c.id,
    callerId: c.callerId,
    receiverId: c.receiverId,
    status: c.status,
    startTime: c.startedAt.toISOString(),
    endTime: c.endedAt ? c.endedAt.toISOString() : null,
  };
}

export default router;
