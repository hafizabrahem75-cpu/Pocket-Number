import { logger } from "./logger";

/**
 * Firebase Cloud Messaging (FCM) client — prep layer for the future Android
 * APK. No app code depends on this module yet except `notifications.ts`,
 * and it degrades to a safe no-op whenever Firebase credentials aren't
 * configured (which is the case today — there is no Android app yet).
 *
 * Credentials are read exclusively from environment variables so they never
 * live in source control:
 *   - FCM_PROJECT_ID
 *   - FCM_CLIENT_EMAIL
 *   - FCM_PRIVATE_KEY   (PEM string; literal "\n" sequences are unescaped)
 *
 * All three must be present for FCM to activate. Until an Android build
 * exists and these are set, `isFcmConfigured()` returns false and
 * `sendPushToTokens` is never invoked by the notification layer.
 */

interface FcmCredentials {
  projectId: string;
  clientEmail: string;
  privateKey: string;
}

function readCredentials(): FcmCredentials | null {
  const projectId = process.env["FCM_PROJECT_ID"];
  const clientEmail = process.env["FCM_CLIENT_EMAIL"];
  const rawPrivateKey = process.env["FCM_PRIVATE_KEY"];

  if (!projectId || !clientEmail || !rawPrivateKey) {
    return null;
  }

  return {
    projectId,
    clientEmail,
    // Env vars can't hold real newlines cleanly, so the private key is
    // typically stored with literal "\n" escapes — unescape them here.
    privateKey: rawPrivateKey.replace(/\\n/g, "\n"),
  };
}

export function isFcmConfigured(): boolean {
  return readCredentials() !== null;
}

// The Firebase Admin app instance is created lazily, once, on first real
// send — never at module load — so importing this file has zero effect
// when FCM isn't configured (e.g. every environment today).
let cachedMessaging: import("firebase-admin/messaging").Messaging | null = null;

async function getMessaging(): Promise<import("firebase-admin/messaging").Messaging | null> {
  if (cachedMessaging) return cachedMessaging;

  const creds = readCredentials();
  if (!creds) return null;

  const { initializeApp, getApps, cert } = await import("firebase-admin/app");
  const { getMessaging: getMessagingInstance } = await import("firebase-admin/messaging");

  const app =
    getApps()[0] ??
    initializeApp({
      credential: cert({
        projectId: creds.projectId,
        clientEmail: creds.clientEmail,
        privateKey: creds.privateKey,
      }),
    });

  cachedMessaging = getMessagingInstance(app);
  return cachedMessaging;
}

export interface FcmSendResult {
  /** Tokens FCM rejected as invalid/unregistered — safe to delete locally. */
  invalidTokens: string[];
}

/**
 * Sends a data+notification payload to a batch of FCM registration tokens.
 * Returns which tokens FCM says are no longer valid so the caller can prune
 * `device_tokens`. Never throws — logs and returns an empty result on
 * failure so a push provider outage can never break the calling request.
 */
export async function sendPushToTokens(
  tokens: string[],
  payload: { title: string; body: string; data?: Record<string, string> },
): Promise<FcmSendResult> {
  if (tokens.length === 0) return { invalidTokens: [] };

  const messaging = await getMessaging();
  if (!messaging) {
    // Should not happen — callers check `isFcmConfigured()` first — but
    // stay defensive rather than throwing.
    logger.debug("sendPushToTokens: FCM not configured, skipping send");
    return { invalidTokens: [] };
  }

  try {
    const response = await messaging.sendEachForMulticast({
      tokens,
      notification: { title: payload.title, body: payload.body },
      data: payload.data,
      android: { priority: "high" },
    });

    const invalidTokens: string[] = [];
    response.responses.forEach((r, i) => {
      if (!r.success) {
        const code = r.error?.code;
        if (
          code === "messaging/registration-token-not-registered" ||
          code === "messaging/invalid-registration-token"
        ) {
          invalidTokens.push(tokens[i]!);
        }
        logger.warn({ code, token: tokens[i] }, "FCM: delivery failed for one token");
      }
    });

    return { invalidTokens };
  } catch (err) {
    logger.error({ err }, "FCM: sendEachForMulticast failed");
    return { invalidTokens: [] };
  }
}
