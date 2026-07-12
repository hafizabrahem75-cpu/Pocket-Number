import { pgTable, serial, text, boolean, timestamp, integer, unique } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod/v4";

export const usersTable = pgTable("users", {
  id: serial("id").primaryKey(),
  pocketNumber: text("pocket_number").notNull().unique(),
  name: text("name").notNull(),
  email: text("email").notNull().unique(),
  passwordHash: text("password_hash").notNull(),
  isVerified: boolean("is_verified").notNull().default(false),
  isOnline: boolean("is_online").notNull().default(false),
  lastSeenAt: timestamp("last_seen_at"),
  createdAt: timestamp("created_at").notNull().defaultNow(),
  /** Role-based authorization — only "admin" may access the admin namespace. */
  role: text("role", { enum: ["user", "admin"] }).notNull().default("user"),
  /** Admin-controlled account lock. Suspended users cannot log in. */
  isSuspended: boolean("is_suspended").notNull().default(false),
});

export const otpCodesTable = pgTable("otp_codes", {
  id: serial("id").primaryKey(),
  email: text("email").notNull(),
  code: text("code").notNull(),
  expiresAt: timestamp("expires_at").notNull(),
  used: boolean("used").notNull().default(false),
  createdAt: timestamp("created_at").notNull().defaultNow(),
});

// Counter table to track last assigned pocket number
export const pocketNumberCounterTable = pgTable("pocket_number_counter", {
  id: integer("id").primaryKey().default(1),
  lastNumber: integer("last_number").notNull().default(100000),
});

// Personal contacts book — each user keeps their own list with custom local names.
// Works like a phone's contacts app: any phone number can be saved, whether or
// not it belongs to a registered Pocket Number user.
export const contactsTable = pgTable(
  "contacts",
  {
    id: serial("id").primaryKey(),
    ownerId: integer("owner_id")
      .notNull()
      .references(() => usersTable.id, { onDelete: "cascade" }),
    // Nullable — set only when the phone number belongs to a registered user.
    // Auto-linked at add-time, and retroactively when that number registers later.
    // SET NULL on delete: if the linked user deletes their account the contact
    // entry is preserved in the owner's book (they saved the number; they keep
    // it) and simply becomes an unlinked / unregistered contact.
    contactUserId: integer("contact_user_id").references(() => usersTable.id, {
      onDelete: "set null",
    }),
    // Canonical normalized phone number (e.g. "+967 76XXXXXXX"), kept even
    // when the contact isn't a registered user yet — this is what lets a
    // matching future registration auto-link the contact.
    phoneNumber: text("phone_number").notNull(),
    // The custom name the owner chose — never visible to anyone else
    localName: text("local_name").notNull(),
    createdAt: timestamp("created_at").notNull().defaultNow(),
    updatedAt: timestamp("updated_at").notNull().defaultNow(),
  },
  (table) => [unique("unique_contact_phone").on(table.ownerId, table.phoneNumber)],
);

// Friendship / contact network
export const friendshipsTable = pgTable(
  "friendships",
  {
    id: serial("id").primaryKey(),
    requesterId: integer("requester_id")
      .notNull()
      .references(() => usersTable.id, { onDelete: "cascade" }),
    addresseeId: integer("addressee_id")
      .notNull()
      .references(() => usersTable.id, { onDelete: "cascade" }),
    status: text("status", { enum: ["pending", "accepted", "rejected"] })
      .notNull()
      .default("pending"),
    createdAt: timestamp("created_at").notNull().defaultNow(),
    updatedAt: timestamp("updated_at").notNull().defaultNow(),
  },
  (table) => [unique("unique_friendship").on(table.requesterId, table.addresseeId)],
);

export const insertUserSchema = createInsertSchema(usersTable).omit({
  id: true,
  createdAt: true,
});

export type InsertUser = z.infer<typeof insertUserSchema>;
export type User = typeof usersTable.$inferSelect;
export type OtpCode = typeof otpCodesTable.$inferSelect;
export type Contact = typeof contactsTable.$inferSelect;
export type Friendship = typeof friendshipsTable.$inferSelect;
