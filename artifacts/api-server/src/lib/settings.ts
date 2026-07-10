import { eq } from "drizzle-orm";
import {
  db,
  appSettingsTable,
  POCKET_NUMBER_COUNTRY_CODE_KEY,
  POCKET_NUMBER_PREFIX_KEY,
  DEFAULT_POCKET_NUMBER_COUNTRY_CODE,
  DEFAULT_POCKET_NUMBER_PREFIX,
} from "@workspace/db";

/**
 * Reads a runtime setting from `app_settings`, falling back to `fallback`
 * when the row doesn't exist yet (fresh install / not configured by Admin).
 */
async function getSetting(key: string, fallback: string): Promise<string> {
  const [row] = await db
    .select({ value: appSettingsTable.value })
    .from(appSettingsTable)
    .where(eq(appSettingsTable.key, key));
  return row?.value ?? fallback;
}

/**
 * Sets (creates or updates) a runtime setting. Used by the Admin settings
 * endpoint — never called from user-facing flows.
 */
export async function setSetting(key: string, value: string): Promise<void> {
  await db
    .insert(appSettingsTable)
    .values({ key, value })
    .onConflictDoUpdate({
      target: appSettingsTable.key,
      set: { value, updatedAt: new Date() },
    });
}

export interface PocketNumberConfig {
  countryCode: string;
  prefix: string;
}

/**
 * Returns the current Pocket Number country code + prefix, as configured by
 * Admin (or the defaults if never configured). Only affects newly generated
 * numbers — existing pocket numbers are never reformatted.
 */
export async function getPocketNumberConfig(): Promise<PocketNumberConfig> {
  const [countryCode, prefix] = await Promise.all([
    getSetting(POCKET_NUMBER_COUNTRY_CODE_KEY, DEFAULT_POCKET_NUMBER_COUNTRY_CODE),
    getSetting(POCKET_NUMBER_PREFIX_KEY, DEFAULT_POCKET_NUMBER_PREFIX),
  ]);
  return { countryCode, prefix };
}
