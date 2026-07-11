import { eq } from "drizzle-orm";
import { db, deviceTokensTable } from "@workspace/db";
import { logger } from "./logger";

/**
 * Notification service foundation.
 *
 * No push provider (Firebase Cloud Messaging or otherwise) is wired up yet.
 * This module gives future call sites (e.g. "notify user of a new
 * message/call") a stable interface to depend on now — only the body of
 * `notifyUser` needs to change once a real provider is added. It is not
 * currently called anywhere; messages/calls logic is untouched.
 */

export interface NotificationPayload {
  title: string;
  body: string;
  data?: Record<string, string>;
}

/** All device tokens currently registered for a user. */
export async function getDeviceTokensForUser(userId: number) {
  return db.select().from(deviceTokensTable).where(eq(deviceTokensTable.userId, userId));
}

/**
 * Send a notification to every device registered for a user.
 *
 * Currently a no-op stub that only logs — swap the body for a real
 * provider call (e.g. Firebase Admin SDK) once that integration is added.
 */
export async function notifyUser(userId: number, payload: NotificationPayload): Promise<void> {
  const devices = await getDeviceTokensForUser(userId);

  if (devices.length === 0) {
    logger.debug({ userId }, "notifyUser: no registered devices, skipping");
    return;
  }

  logger.info(
    { userId, deviceCount: devices.length, title: payload.title },
    "notifyUser: would dispatch notification (no push provider configured yet)",
  );

  // TODO: once a push provider is added, iterate `devices` and dispatch
  // `payload` to each device.token according to device.platform.
}
