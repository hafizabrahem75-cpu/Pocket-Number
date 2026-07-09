import { Router, type IRouter } from "express";
import { eq, and } from "drizzle-orm";
import { db, usersTable, contactsTable } from "@workspace/db";
import { requireAuth, type AuthRequest } from "../middlewares/auth";

const router: IRouter = Router();

/** Validate a path param as a positive integer, or return null. */
function parseId(raw: string | undefined): number | null {
  const n = Number(raw);
  return Number.isInteger(n) && n > 0 ? n : null;
}

const LOCAL_NAME_MAX = 50;

// GET /contacts — caller's personal contacts book
router.get("/contacts", requireAuth, async (req: AuthRequest, res): Promise<void> => {
  const ownerId = req.userId!;

  const rows = await db
    .select({
      id: contactsTable.id,
      localName: contactsTable.localName,
      createdAt: contactsTable.createdAt,
      pocketNumber: usersTable.pocketNumber,
      isVerified: usersTable.isVerified,
    })
    .from(contactsTable)
    .innerJoin(usersTable, eq(usersTable.id, contactsTable.contactUserId))
    .where(eq(contactsTable.ownerId, ownerId))
    .orderBy(contactsTable.localName);

  res.json(
    rows.map((row) => ({
      id: row.id,
      localName: row.localName,
      pocketNumber: row.pocketNumber,
      isVerified: row.isVerified,
      createdAt: row.createdAt.toISOString(),
    })),
  );
});

// POST /contacts — add a contact by Pocket Number
router.post("/contacts", requireAuth, async (req: AuthRequest, res): Promise<void> => {
  const ownerId = req.userId!;
  const { pocketNumber, localName } = req.body ?? {};

  if (!pocketNumber || typeof pocketNumber !== "string") {
    res.status(400).json({ error: "pocketNumber مطلوب" });
    return;
  }

  const normalised = pocketNumber.trim().toUpperCase();

  // Resolve target user
  const [target] = await db
    .select({ id: usersTable.id, name: usersTable.name, pocketNumber: usersTable.pocketNumber, isVerified: usersTable.isVerified })
    .from(usersTable)
    .where(eq(usersTable.pocketNumber, normalised));

  if (!target) {
    res.status(404).json({ error: "لم يُعثر على مستخدم بهذا الرقم" });
    return;
  }

  if (target.id === ownerId) {
    res.status(400).json({ error: "لا يمكنك إضافة نفسك إلى جهات الاتصال" });
    return;
  }

  const trimmedLocalName =
    typeof localName === "string" ? localName.trim() : "";
  if (trimmedLocalName.length > LOCAL_NAME_MAX) {
    res.status(400).json({ error: `الاسم المحلي يجب ألا يتجاوز ${LOCAL_NAME_MAX} حرفاً` });
    return;
  }
  const resolvedLocalName = trimmedLocalName.length > 0 ? trimmedLocalName : target.name;

  try {
    const [created] = await db
      .insert(contactsTable)
      .values({ ownerId, contactUserId: target.id, localName: resolvedLocalName })
      .returning();

    res.status(201).json({
      id: created.id,
      localName: created.localName,
      pocketNumber: target.pocketNumber,
      isVerified: target.isVerified,
      createdAt: created.createdAt.toISOString(),
    });
  } catch (err: any) {
    // Unique constraint violation — already in contacts
    if (err?.code === "23505") {
      res.status(409).json({ error: "هذا المستخدم موجود بالفعل في جهات اتصالك" });
      return;
    }
    throw err;
  }
});

// PUT /contacts/:id — update local name
router.put("/contacts/:id", requireAuth, async (req: AuthRequest, res): Promise<void> => {
  const ownerId = req.userId!;
  const id = parseId(String(req.params.id ?? ""));
  if (!id) {
    res.status(400).json({ error: "معرّف جهة الاتصال غير صحيح" });
    return;
  }

  const { localName } = req.body ?? {};
  const trimmed = typeof localName === "string" ? localName.trim() : "";
  if (trimmed.length === 0) {
    res.status(400).json({ error: "الاسم المحلي مطلوب" });
    return;
  }
  if (trimmed.length > LOCAL_NAME_MAX) {
    res.status(400).json({ error: `الاسم المحلي يجب ألا يتجاوز ${LOCAL_NAME_MAX} حرفاً` });
    return;
  }

  // Verify ownership, then mutate — ownerId in both checks (defense-in-depth)
  const [existing] = await db
    .select({ id: contactsTable.id, contactUserId: contactsTable.contactUserId })
    .from(contactsTable)
    .where(and(eq(contactsTable.id, id), eq(contactsTable.ownerId, ownerId)));

  if (!existing) {
    res.status(404).json({ error: "جهة الاتصال غير موجودة" });
    return;
  }

  const [updated] = await db
    .update(contactsTable)
    .set({ localName: trimmed, updatedAt: new Date() })
    .where(and(eq(contactsTable.id, id), eq(contactsTable.ownerId, ownerId)))
    .returning();

  const [contactUser] = await db
    .select({ pocketNumber: usersTable.pocketNumber, isVerified: usersTable.isVerified })
    .from(usersTable)
    .where(eq(usersTable.id, existing.contactUserId));

  res.json({
    id: updated.id,
    localName: updated.localName,
    pocketNumber: contactUser?.pocketNumber ?? "",
    isVerified: contactUser?.isVerified ?? false,
    createdAt: updated.createdAt.toISOString(),
  });
});

// DELETE /contacts/:id — remove a contact
router.delete("/contacts/:id", requireAuth, async (req: AuthRequest, res): Promise<void> => {
  const ownerId = req.userId!;
  const id = parseId(String(req.params.id ?? ""));
  if (!id) {
    res.status(400).json({ error: "معرّف جهة الاتصال غير صحيح" });
    return;
  }

  const [existing] = await db
    .select({ id: contactsTable.id })
    .from(contactsTable)
    .where(and(eq(contactsTable.id, id), eq(contactsTable.ownerId, ownerId)));

  if (!existing) {
    res.status(404).json({ error: "جهة الاتصال غير موجودة" });
    return;
  }

  // ownerId included in mutation WHERE as defense-in-depth
  await db
    .delete(contactsTable)
    .where(and(eq(contactsTable.id, id), eq(contactsTable.ownerId, ownerId)));

  res.json({ message: "تم حذف جهة الاتصال" });
});

export default router;
