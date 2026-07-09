import {
  pgTable,
  serial,
  integer,
  text,
  timestamp,
  index,
} from "drizzle-orm/pg-core";

import { usersTable } from "./users";

/**
 * Message delivery lifecycle:
 *   sent      → message stored on server, not yet delivered to recipient's device
 *   delivered → recipient's device has received the message
 *   read      → recipient has opened/read the message
 *
 * E2E Encryption readiness:
 *   - `content` stores the ciphertext (encrypted payload). In Phase 1 it holds
 *     plaintext, but the column type and name are chosen so that swapping in
 *     encrypted bytes requires no schema migration.
 *   - `contentIv` / `contentTag` are reserved for the AES-GCM IV and
 *     authentication tag that will be introduced when E2EE is added. They are
 *     nullable so Phase 1 rows are valid without them.
 *   - `senderPublicKey` is reserved for the sender's ephemeral public key
 *     (X25519 / Double Ratchet handshake). Nullable for Phase 1.
 *   - `contentType` distinguishes text from future binary types (image, audio,
 *     file) without a schema change.
 */
export const messagesTable = pgTable(
  "messages",
  {
    id: serial("id").primaryKey(),

    /** The user who sent this message. */
    senderId: integer("sender_id")
      .notNull()
      .references(() => usersTable.id, { onDelete: "cascade" }),

    /** The user who receives this message. */
    recipientId: integer("recipient_id")
      .notNull()
      .references(() => usersTable.id, { onDelete: "cascade" }),

    /**
     * Message body.
     * Phase 1: plaintext string.
     * Phase 2 (E2EE): base64url-encoded ciphertext; paired with contentIv and
     * contentTag for AES-GCM authenticated decryption on the recipient device.
     */
    content: text("content").notNull(),

    /** MIME-like type hint. Defaults to plain text. Reserved for future types. */
    contentType: text("content_type").notNull().default("text/plain"),

    /**
     * AES-GCM initialisation vector (base64url). NULL in Phase 1.
     * Required in Phase 2 when content is encrypted.
     */
    contentIv: text("content_iv"),

    /**
     * AES-GCM authentication tag (base64url). NULL in Phase 1.
     * Validates ciphertext integrity on decryption.
     */
    contentTag: text("content_tag"),

    /**
     * Sender's ephemeral public key (base64url, X25519). NULL in Phase 1.
     * Used during the Double Ratchet key-exchange step in Phase 2.
     */
    senderPublicKey: text("sender_public_key"),

    /**
     * Delivery state machine:
     *   sent → delivered → read
     * Only the recipient's client may advance the state forward.
     */
    status: text("status", {
      enum: ["sent", "delivered", "read"],
    })
      .notNull()
      .default("sent"),

    /** When the message was created on the server. */
    createdAt: timestamp("created_at").notNull().defaultNow(),

    /** When status last changed (delivered or read timestamp). */
    updatedAt: timestamp("updated_at").notNull().defaultNow(),

    /** Soft-delete: sender may retract a message before it is read. */
    deletedAt: timestamp("deleted_at"),
  },
  (table) => [
    // Fast lookup of a conversation between two users, newest-first
    index("idx_messages_conversation").on(
      table.senderId,
      table.recipientId,
      table.createdAt,
    ),
    // Recipient's inbox query
    index("idx_messages_recipient").on(table.recipientId, table.createdAt),
    // Status-based queries (e.g. count unread)
    index("idx_messages_status").on(table.recipientId, table.status),
  ],
);

export type Message = typeof messagesTable.$inferSelect;
export type NewMessage = typeof messagesTable.$inferInsert;
