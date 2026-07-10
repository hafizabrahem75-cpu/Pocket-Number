import { pgTable, text, timestamp } from "drizzle-orm/pg-core";

// Generic key/value settings store — lets Admin tune runtime behavior
// (e.g. Pocket Number country code / prefix) without code changes.
export const appSettingsTable = pgTable("app_settings", {
  key: text("key").primaryKey(),
  value: text("value").notNull(),
  updatedAt: timestamp("updated_at").notNull().defaultNow(),
});

export type AppSetting = typeof appSettingsTable.$inferSelect;

// Well-known setting keys used by the Pocket Number generator.
// Defaults match the current numbering scheme; Admin can override at runtime.
export const POCKET_NUMBER_COUNTRY_CODE_KEY = "pocket_number_country_code";
export const POCKET_NUMBER_PREFIX_KEY = "pocket_number_prefix";

export const DEFAULT_POCKET_NUMBER_COUNTRY_CODE = "+967";
export const DEFAULT_POCKET_NUMBER_PREFIX = "76";
