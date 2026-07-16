import { and, eq, inArray, lt } from "drizzle-orm";
import { db, callsTable } from "@workspace/db";
import { logger } from "./logger";

/**
 * Background job — sweeps for ringing calls that were never answered and
 * marks them as "missed".
 *
 * Why here and not in the route:
 *   The receiver may never respond (tab closed, push not received, etc.)
 *   so the route's PATCH endpoint can never be the sole mechanism.  A
 *   periodic sweep on the server is the only reliable way to guarantee
 *   no call stays in "ringing" forever.
 *
 * Timeout window: 60 s — long enough for a human to notice an incoming
 * call on a slow device, short enough that stale "ringing" records don't
 * accumulate.  The caller-side UI enforces the same 60 s and auto-cancels
 * the overlay then (see CallLauncherContext), so both sides converge on
 * the same expiry without coordination.
 *
 * Poll cadence: 15 s — a call can only become eligible after 60 s, so
 * this poll adds at most 15 s of extra latency before the DB is updated.
 * Lower is unnecessary; higher would leave the DB dirty for too long.
 */

const RINGING_TIMEOUT_MS = 60_000; // 60 s — must match CALLER_RING_TIMEOUT_MS in the frontend
const POLL_INTERVAL_MS = 15_000;

export function startCallTimeoutJob(): () => void {
  const tick = async () => {
    try {
      const cutoff = new Date(Date.now() - RINGING_TIMEOUT_MS);

      const expired = await db
        .update(callsTable)
        .set({ status: "missed", endedAt: new Date() })
        .where(
          and(
            eq(callsTable.status, "ringing"),
            lt(callsTable.startedAt, cutoff),
          ),
        )
        .returning({ id: callsTable.id });

      if (expired.length > 0) {
        logger.info(
          { count: expired.length, ids: expired.map((c) => c.id) },
          "callTimeouts: expired ringing calls marked as missed",
        );
      }
    } catch (err) {
      // Never let a sweep failure crash the server — just log and carry on.
      logger.error({ err }, "callTimeouts: sweep failed");
    }
  };

  // Run once immediately on startup so tests and short-lived dev restarts
  // don't have to wait a full poll interval to see stale calls expire.
  void tick();

  const handle = setInterval(() => void tick(), POLL_INTERVAL_MS);

  // Return a cleanup function so the caller can shut the interval down
  // cleanly (useful in tests and graceful shutdown handlers).
  return () => clearInterval(handle);
}
