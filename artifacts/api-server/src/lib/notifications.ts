import { eq, inArray } from "drizzle-orm";
import { db, deviceTokensTable } from "@workspace/db";
import { logger } from "./logger";
import { isFcmConfigured, sendPushToTokens } from "./fcm";

/**
 * Notification service foundation.
 *
 * `notifyUser` dispatches through Firebase Cloud Messaging (FCM) for
 * Android devices once FCM credentials are configured (see `./fcm.ts`).
 * Today, in every environment without those credentials — i.e. before the
 * Android APK exists — this stays a log-only no-op exactly as before, so
 * this change cannot affect current behavior. It is not called from any
 * route directly; messages/calls logic only reports events through
 * `notificationEvents.ts`, which is untouched here.
 *
 * iOS/web push delivery is intentionally out of scope — only Android is
 * targeted for now — those devices simply stay in the log-only path.
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
 * Android devices are sent through FCM when configured; every other case
 * (no devices, FCM not configured, non-Android platform) falls back to the
 * original log-only stub behavior.
 */
export async function notifyUser(userId: number, payload: NotificationPayload): Promise<void> {
  const devices = await getDeviceTokensForUser(userId);

  if (devices.length === 0) {
    logger.debug({ userId }, "notifyUser: no registered devices, skipping");
    return;
  }

  if (!isFcmConfigured()) {
    logger.info(
      { userId, deviceCount: devices.length, title: payload.title },
      "notifyUser: would dispatch notification (no push provider configured yet)",
    );
    return;
  }

  const androidTokens = devices.filter((d) => d.platform === "android").map((d) => d.token);
  const otherDeviceCount = devices.length - androidTokens.length;

  if (otherDeviceCount > 0) {
    logger.debug(
      { userId, otherDeviceCount },
      "notifyUser: non-Android devices are not dispatched yet (Android-only for now)",
    );
  }

  if (androidTokens.length === 0) return;

  const { invalidTokens } = await sendPushToTokens(androidTokens, payload);

  if (invalidTokens.length > 0) {
    await db.delete(deviceTokensTable).where(inArray(deviceTokensTable.token, invalidTokens));
    logger.info({ userId, count: invalidTokens.length }, "notifyUser: pruned invalid device tokens");
  }
}
