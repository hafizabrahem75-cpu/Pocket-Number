import { Router, type IRouter } from "express";
import { eq, and, or } from "drizzle-orm";
import { db, usersTable, contactsTable } from "@workspace/db";
import { requireAuth, type AuthRequest } from "../middlewares/auth";
import { normalizePhoneNumber } from "../lib/phone";

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

  // LEFT JOIN: unregistered numbers have no matching user row.
  const rows = await db
    .select({
      id: contactsTable.id,
      localName: contactsTable.localName,
      createdAt: contactsTable.createdAt,
      phoneNumber: contactsTable.phoneNumber,
      // Include contactUserId so we can expose isLinked to the client.
      contactUserId: contactsTable.contactUserId,
      linkedPocketNumber: usersTable.pocketNumber,
      linkedIsVerified: usersTable.isVerified,
    })
    .from(contactsTable)
    .leftJoin(usersTable, eq(usersTable.id, contactsTable.contactUserId))
    .where(eq(contactsTable.ownerId, ownerId))
    .orderBy(contactsTable.localName);

  res.json(
    rows.map((row) => ({
      id: row.id,
      localName: row.localName,
      pocketNumber: row.linkedPocketNumber ?? row.phoneNumber,
      isLinked: row.contactUserId !== null,
      isVerified: row.linkedIsVerified ?? false,
      createdAt: row.createdAt.toISOString(),
    })),
  );
});

// POST /contacts — add a contact by phone number (registered or not)
router.post("/contacts", requireAuth, async (req: AuthRequest, res): Promise<void> => {
  const ownerId = req.userId!;
  const { phoneNumber, localName } = req.body ?? {};

  if (!phoneNumber || typeof phoneNumber !== "string") {
    res.status(400).json({ error: "رقم الهاتف مطلوب" });
    return;
  }

  const normalized = await normalizePhoneNumber(phoneNumber);
  if (!normalized) {
    res.status(400).json({ error: "صيغة رقم الهاتف غير صحيحة" });
    return;
  }

  // Resolve target user, if the number is registered. New-format accounts
  // store the canonical "+<cc> <local>" form; legacy accounts (created before
  // the country-code change) store just the bare local digits.
  const [target] = await db
    .select({ id: usersTable.id, name: usersTable.name, pocketNumber: usersTable.pocketNumber, isVerified: usersTable.isVerified })
    .from(usersTable)
    .where(or(eq(usersTable.pocketNumber, normalized.canonical), eq(usersTable.pocketNumber, normalized.local)));

  if (target && target.id === ownerId) {
    res.status(400).json({ error: "لا يمكنك إضافة نفسك إلى جهات الاتصال" });
    return;
  }

  const trimmedLocalName =
    typeof localName === "string" ? localName.trim() : "";
  if (trimmedLocalName.length > LOCAL_NAME_MAX) {
    res.status(400).json({ error: `الاسم المحلي يجب ألا يتجاوز ${LOCAL_NAME_MAX} حرفاً` });
    return;
  }
  const fallbackName = target?.name ?? normalized.canonical;
  const resolvedLocalName = trimmedLocalName.length > 0 ? trimmedLocalName : fallbackName;

  // Store the target's exact registered pocket number when linked (so it
  // stays correct even if formatting differs from our canonical form), or
  // the canonical form for a local-only contact — this is also the value
  // future registrations are matched against for auto-linking.
  const storedPhoneNumber = target?.pocketNumber ?? normalized.canonical;

  try {
    const [created] = await db
      .insert(contactsTable)
      .values({
        ownerId,
        contactUserId: target?.id ?? null,
        phoneNumber: storedPhoneNumber,
        localName: resolvedLocalName,
      })
      .returning();

    res.status(201).json({
      id: created.id,
      localName: created.localName,
      pocketNumber: target?.pocketNumber ?? storedPhoneNumber,
      isLinked: target !== undefined,
      isVerified: target?.isVerified ?? false,
      createdAt: created.createdAt.toISOString(),
    });
  } catch (err: any) {
    // Unique constraint violation — already in contacts.
    // node-postgres wraps the pg error as `err.cause` under drizzle-orm, so
    // the Postgres error code can live on either the top-level error or `.cause`.
    if (err?.code === "23505" || err?.cause?.code === "23505") {
      res.status(409).json({ error: "هذا الرقم موجود بالفعل في جهات اتصالك" });
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

  // Only look up the linked user when contactUserId is non-null.
  // Passing null to eq() is a type error and produces a broken WHERE clause.
  let contactUser: { pocketNumber: string; isVerified: boolean } | undefined;
  if (existing.contactUserId !== null) {
    [contactUser] = await db
      .select({ pocketNumber: usersTable.pocketNumber, isVerified: usersTable.isVerified })
      .from(usersTable)
      .where(eq(usersTable.id, existing.contactUserId));
  }

  res.json({
    id: updated.id,
    localName: updated.localName,
    // Fall back to the stored phoneNumber for unregistered contacts so the
    // response never returns an empty string.
    pocketNumber: contactUser?.pocketNumber ?? updated.phoneNumber,
    isLinked: existing.contactUserId !== null,
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
