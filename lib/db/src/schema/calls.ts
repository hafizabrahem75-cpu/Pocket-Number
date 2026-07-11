import { pgTable, serial, integer, text, timestamp, index } from "drizzle-orm/pg-core";

import { usersTable } from "./users";

/**
 * Voice call foundation (Phase 1 — no audio/WebRTC yet).
 *
 * Call lifecycle:
 *   ringing  → call created, receiver has not yet responded
 *   ongoing  → receiver answered, call is in progress
 *   ended    → call finished normally (either party hung up after answering)
 *   missed   → receiver never answered (timed out / caller cancelled)
 *   declined → receiver explicitly rejected the call
 *
 * `startedAt` is set when the call is created (ringing begins).
 * `endedAt` is set once the call reaches a terminal state (ended, missed, declined).
 * Audio transport (WebRTC signaling, SDP/ICE, media servers) is intentionally
 * out of scope — this table only tracks call metadata/history.
 */
export const callsTable = pgTable(
  "calls",
  {
    id: serial("id").primaryKey(),

    /** The user who initiated the call. */
    callerId: integer("caller_id")
      .notNull()
      .references(() => usersTable.id, { onDelete: "cascade" }),

    /** The user being called. */
    receiverId: integer("receiver_id")
      .notNull()
      .references(() => usersTable.id, { onDelete: "cascade" }),

    /** Call lifecycle state — see table doc comment above. */
    status: text("status", {
      enum: ["ringing", "ongoing", "ended", "missed", "declined"],
    })
      .notNull()
      .default("ringing"),

    /** When the call was initiated (ringing began). */
    startedAt: timestamp("started_at").notNull().defaultNow(),

    /** When the call reached a terminal state. Null while ringing/ongoing. */
    endedAt: timestamp("ended_at"),
  },
  (table) => [
    // Call history for a given user, newest-first
    index("idx_calls_caller").on(table.callerId, table.startedAt),
    index("idx_calls_receiver").on(table.receiverId, table.startedAt),
  ],
);

export type Call = typeof callsTable.$inferSelect;
export type NewCall = typeof callsTable.$inferInsert;
