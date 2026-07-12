import { notifyUser } from "./notifications";
import { logger } from "./logger";

/**
 * Notification *events* — the only thing messages/calls routes should know
 * about notifications. Each function here takes plain primitives (no
 * Drizzle rows, no schema imports) and turns them into a `notifyUser` call.
 *
 * This is intentionally a thin translation layer: it owns "what a new
 * message / incoming call notification looks like" so that:
 *   - messages.ts / calls.ts stay unaware of notification payload shape,
 *     device tokens, or push providers — they just report "this happened".
 *   - notifications.ts (`notifyUser`) stays unaware of messages/calls —
 *     it only ever sees a generic title/body/data payload.
 *
 * Every event here is fire-and-forget from the caller's perspective: it
 * never throws, so a notification failure can never affect the
 * message/call REST response.
 */

const MESSAGE_PREVIEW_MAX = 120;

export interface NewMessageEvent {
  recipientId: number;
  senderId: number;
  /** Plaintext content preview — already validated/trimmed by the caller. */
  content: string;
}

/** Fired right after a message is persisted. Never throws. */
export async function notifyNewMessage(event: NewMessageEvent): Promise<void> {
  try {
    const preview =
      event.content.length > MESSAGE_PREVIEW_MAX
        ? `${event.content.slice(0, MESSAGE_PREVIEW_MAX)}…`
        : event.content;

    await notifyUser(event.recipientId, {
      title: "رسالة جديدة",
      body: preview,
      data: {
        type: "message",
        senderId: String(event.senderId),
      },
    });
  } catch (err) {
    logger.error({ err, event: "new_message", recipientId: event.recipientId }, "notification event failed");
  }
}

export interface IncomingCallEvent {
  callId: number;
  callerId: number;
  receiverId: number;
}

/** Fired right after a call is created (status "ringing"). Never throws. */
export async function notifyIncomingCall(event: IncomingCallEvent): Promise<void> {
  try {
    await notifyUser(event.receiverId, {
      title: "مكالمة واردة",
      body: "لديك مكالمة واردة",
      data: {
        type: "call",
        callId: String(event.callId),
        callerId: String(event.callerId),
      },
    });
  } catch (err) {
    logger.error({ err, event: "incoming_call", receiverId: event.receiverId }, "notification event failed");
  }
}
