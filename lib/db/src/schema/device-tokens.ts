import { pgTable, serial, integer, text, timestamp, uniqueIndex, index } from "drizzle-orm/pg-core";

import { usersTable } from "./users";

/**
 * Notification foundation (device registration only — no push provider yet).
 *
 * Stores opaque device push tokens linked to the user currently signed in
 * on that device. `token` is globally unique: if the same physical device
 * re-registers (e.g. a different user logs in on the same phone/browser),
 * the existing row is reassigned to the new user instead of duplicated.
 *
 * Sending actual push notifications (Firebase Cloud Messaging or otherwise)
 * is intentionally out of scope here — see
 * artifacts/api-server/src/lib/notifications.ts for the (currently no-op)
 * service structure that will consume this table once a provider is wired up.
 */
export const deviceTokensTable = pgTable(
  "device_tokens",
  {
    id: serial("id").primaryKey(),

    /** The user currently signed in on this device. */
    userId: integer("user_id")
      .notNull()
      .references(() => usersTable.id, { onDelete: "cascade" }),

    /** Opaque push token issued by the (future) notification provider. */
    token: text("token").notNull(),

    /** Device platform — kept generic since no push provider is wired up yet. */
    platform: text("platform", { enum: ["ios", "android", "web"] }).notNull(),

    createdAt: timestamp("created_at").notNull().defaultNow(),

    /** Refreshed every time the device re-registers (e.g. on app open). */
    lastSeenAt: timestamp("last_seen_at").notNull().defaultNow(),
  },
  (table) => [
    uniqueIndex("idx_device_tokens_token").on(table.token),
    index("idx_device_tokens_user").on(table.userId),
  ],
);

export type DeviceToken = typeof deviceTokensTable.$inferSelect;
export type NewDeviceToken = typeof deviceTokensTable.$inferInsert;
