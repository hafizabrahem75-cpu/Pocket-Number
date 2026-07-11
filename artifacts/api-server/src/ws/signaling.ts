import type { Server as HttpServer, IncomingMessage } from "http";
import { WebSocketServer, WebSocket } from "ws";
import { eq, and, or, inArray } from "drizzle-orm";
import { db, callsTable } from "@workspace/db";
import { verifyToken } from "../lib/jwt";
import { logger } from "../lib/logger";

/**
 * Minimal WebRTC signaling relay for voice calls.
 *
 * This server does NOT participate in media — it only relays SDP
 * offers/answers and ICE candidates between the two participants of an
 * existing call record (see lib/db/src/schema/calls.ts). The call lifecycle
 * itself (ringing/ongoing/ended/missed/declined) is unchanged and still
 * managed exclusively via the REST endpoints in routes/calls.ts.
 */

const SIGNALING_PATH = "/api/ws/calls";

const ALLOWED_TYPES = new Set(["offer", "answer", "ice-candidate", "hangup"]);
const NON_TERMINAL_STATUSES = ["ringing", "ongoing"] as const;

interface SignalingMessage {
  type: "offer" | "answer" | "ice-candidate" | "hangup";
  callId: number;
  targetUserId: number;
  sdp?: unknown;
  candidate?: unknown;
}

function parsePositiveInt(value: unknown): number | null {
  const n = Number(value);
  return Number.isInteger(n) && n > 0 ? n : null;
}

function parseMessage(raw: unknown): SignalingMessage | null {
  if (typeof raw !== "object" || raw === null) return null;
  const obj = raw as Record<string, unknown>;

  if (typeof obj.type !== "string" || !ALLOWED_TYPES.has(obj.type)) return null;

  const callId = parsePositiveInt(obj.callId);
  const targetUserId = parsePositiveInt(obj.targetUserId);
  if (!callId || !targetUserId) return null;

  return {
    type: obj.type as SignalingMessage["type"],
    callId,
    targetUserId,
    sdp: obj.sdp,
    candidate: obj.candidate,
  };
}

/** Extract `?token=` from the upgrade request URL. */
function extractToken(req: IncomingMessage): string | null {
  try {
    const url = new URL(req.url ?? "", "http://internal");
    return url.searchParams.get("token");
  } catch {
    return null;
  }
}

export function attachSignalingServer(httpServer: HttpServer): void {
  const wss = new WebSocketServer({ noServer: true });

  // userId -> connected sockets (a user could have more than one tab/device open)
  const connections = new Map<number, Set<WebSocket>>();

  httpServer.on("upgrade", (req, socket, head) => {
    const url = new URL(req.url ?? "", "http://internal");
    if (url.pathname !== SIGNALING_PATH) return; // let other upgrade handlers (if any) deal with it

    const token = extractToken(req);
    const payload = token ? verifyToken(token) : null;

    if (!payload) {
      socket.write("HTTP/1.1 401 Unauthorized\r\n\r\n");
      socket.destroy();
      return;
    }

    wss.handleUpgrade(req, socket, head, (ws) => {
      wss.emit("connection", ws, req, payload.userId);
    });
  });

  wss.on("connection", (ws: WebSocket, _req: IncomingMessage, userId: number) => {
    let sockets = connections.get(userId);
    if (!sockets) {
      sockets = new Set();
      connections.set(userId, sockets);
    }
    sockets.add(ws);

    ws.on("message", (raw) => {
      void handleMessage(userId, raw, connections);
    });

    ws.on("close", () => {
      sockets?.delete(ws);
      if (sockets && sockets.size === 0) {
        connections.delete(userId);
      }
    });

    ws.on("error", (err) => {
      logger.warn({ err, userId }, "Signaling socket error");
    });
  });
}

async function handleMessage(
  senderId: number,
  raw: unknown,
  connections: Map<number, Set<WebSocket>>,
): Promise<void> {
  let parsedJson: unknown;
  try {
    parsedJson = JSON.parse(String(raw));
  } catch {
    return; // ignore malformed frames
  }

  const message = parseMessage(parsedJson);
  if (!message) return;

  const { callId, targetUserId } = message;

  // Verify the sender and target are the two participants of a non-terminal
  // call before relaying anything — this is the only trust boundary here.
  const [call] = await db
    .select({ id: callsTable.id })
    .from(callsTable)
    .where(
      and(
        eq(callsTable.id, callId),
        inArray(callsTable.status, NON_TERMINAL_STATUSES),
        or(
          and(eq(callsTable.callerId, senderId), eq(callsTable.receiverId, targetUserId)),
          and(eq(callsTable.callerId, targetUserId), eq(callsTable.receiverId, senderId)),
        ),
      ),
    );

  if (!call) return; // not a valid, active call between these two users — drop silently

  const targetSockets = connections.get(targetUserId);
  if (!targetSockets || targetSockets.size === 0) return; // peer not connected — nothing to relay to

  const outgoing = JSON.stringify({
    type: message.type,
    callId: message.callId,
    fromUserId: senderId,
    sdp: message.sdp,
    candidate: message.candidate,
  });

  for (const socket of targetSockets) {
    if (socket.readyState === WebSocket.OPEN) {
      socket.send(outgoing);
    }
  }
}
