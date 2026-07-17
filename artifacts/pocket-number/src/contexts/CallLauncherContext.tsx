import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState, type ReactNode } from "react";

/**
 * How long the caller waits for an answer before auto-cancelling.
 * Must match RINGING_TIMEOUT_MS in the backend callTimeouts.ts so that
 * both sides converge on the same expiry at the same moment.
 */
const CALLER_RING_TIMEOUT_MS = 60_000;
import {
  useStartCall,
  useUpdateCallStatus,
  useGetCallHistory,
  useGetContacts,
  getGetCallHistoryQueryKey,
  searchUsers,
  getUserById,
} from "@workspace/api-client-react";
import type { CallItem } from "@workspace/api-client-react";
import { useAuth } from "@/contexts/AuthContext";
import { isTerminalCallStatus } from "@/lib/callDisplay";

/** How long a terminal state (ended/missed/declined/busy) stays on screen
 * before the overlay auto-closes — long enough to read, short enough to
 * feel responsive. Purely a UI timing concern; the REST call lifecycle
 * itself is unaffected. */
const TERMINAL_STATE_DISPLAY_MS = 2500;

/** Minimal identity needed to place a call. */
export interface CallPeer {
  peerId: number;
  peerName: string;
  peerPocketNumber: string;
}

interface ActiveCall {
  call: CallItem;
  peer: CallPeer;
}

interface CallLauncherState {
  /** The call currently shown in the full-screen overlay, if any. */
  activeCall: ActiveCall | null;
  /** Start a call with an already-resolved user. */
  startCall: (peer: CallPeer) => Promise<void>;
  /** Resolve a pocket number to a user, then start a call — used by the dial pad. */
  startCallByPocketNumber: (pocketNumber: string) => Promise<void>;
  /** Hang up the active call (declines if still ringing, ends if ongoing) and clears it. */
  endCall: () => void;
  /** Dismiss the overlay immediately (safe to call only after the call has reached a terminal state). */
  clearCall: () => void;
  isStarting: boolean;
  error: string | null;
  clearError: () => void;
  /** A call ringing for the current user (someone else called them), if any. */
  incomingCall: CallItem | null;
  /** Accept the incoming call (marks it ongoing). */
  acceptIncomingCall: () => void;
  /** Reject the incoming call (marks it declined). */
  rejectIncomingCall: () => void;
}

const CallLauncherContext = createContext<CallLauncherState | null>(null);

export function CallLauncherProvider({ children }: { children: ReactNode }) {
  const { user } = useAuth();
  const [activeCall, setActiveCall] = useState<ActiveCall | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [dismissedCallId, setDismissedCallId] = useState<number | null>(null);
  const startCallMutation = useStartCall();
  const updateStatusMutation = useUpdateCallStatus();
  const callerRingTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Poll call history for a ringing call placed by someone else to this user.
  // No WebSocket/push exists yet, so short polling mirrors the pattern already
  // used for messages (see MessagesTab).
  const { data: historyData } = useGetCallHistory(undefined, {
    query: { queryKey: getGetCallHistoryQueryKey(undefined), enabled: !!user, refetchInterval: 3000 },
  });

  // Load contacts so we can apply V1 identity rule: show local name if saved,
  // pocket number only otherwise — never the other user's account display name.
  const { data: contacts } = useGetContacts();

  // Keep the caller's own view of activeCall.call in sync with the polled
  // history so it reflects remote status changes (e.g. the receiver
  // accepting/declining) — needed for WebRTC to know when to start.
  useEffect(() => {
    if (!activeCall) return;
    const latest = historyData?.calls?.find((c) => c.id === activeCall.call.id);
    if (latest && latest.status !== activeCall.call.status) {
      setActiveCall((current) => (current ? { ...current, call: latest } : current));
    }
  }, [historyData, activeCall]);

  // Once a call reaches a terminal status (ended/missed/declined — however
  // that happened: our own hangup, the peer's, or a server-side timeout
  // picked up by polling) briefly keep the overlay up so the user sees why
  // the call ended, then clear it. This only affects how long the overlay
  // stays visible, not the REST call lifecycle itself.
  const terminalTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  useEffect(() => {
    if (!activeCall || !isTerminalCallStatus(activeCall.call.status)) {
      return;
    }
    terminalTimerRef.current = setTimeout(() => {
      setActiveCall(null);
    }, TERMINAL_STATE_DISPLAY_MS);
    return () => {
      if (terminalTimerRef.current) clearTimeout(terminalTimerRef.current);
    };
  }, [activeCall?.call.id, activeCall?.call.status]);

  // ── Caller-side ring timeout ──────────────────────────────────────────────
  // If this user placed the call and the receiver hasn't answered within
  // CALLER_RING_TIMEOUT_MS, cancel the call automatically.  This mirrors the
  // server-side sweep in callTimeouts.ts so the overlay clears promptly even
  // if the server's next poll tick hasn't fired yet.
  //
  // We mark it "declined" rather than "missed" because the PATCH state machine
  // only allows ringing → {ongoing, missed, declined}: the caller's cancellation
  // is semantically a "declined" (withdrawal), while "missed" is reserved for
  // server-side expiry from the receiver's perspective.
  useEffect(() => {
    if (callerRingTimerRef.current) {
      clearTimeout(callerRingTimerRef.current);
      callerRingTimerRef.current = null;
    }

    const isCaller = activeCall?.call.callerId === user?.id;
    if (!activeCall || activeCall.call.status !== "ringing" || !isCaller) {
      return;
    }

    callerRingTimerRef.current = setTimeout(() => {
      // endCall() reads the current activeCall status and transitions
      // ringing → declined, then optimistically clears the overlay.
      endCall();
    }, CALLER_RING_TIMEOUT_MS);

    return () => {
      if (callerRingTimerRef.current) {
        clearTimeout(callerRingTimerRef.current);
        callerRingTimerRef.current = null;
      }
    };
  // endCall is stable (useCallback with no deps that change), so including it
  // here doesn't cause spurious re-runs. user?.id only changes on login/logout.
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [activeCall?.call.id, activeCall?.call.status, user?.id]);
  // ─────────────────────────────────────────────────────────────────────────

  const incomingCall = useMemo<CallItem | null>(() => {
    if (!user) return null;
    const calls = historyData?.calls ?? [];
    return (
      calls.find(
        (c) =>
          c.status === "ringing" && c.receiverId === user.id && c.callerId !== user.id && c.id !== dismissedCallId,
      ) ?? null
    );
  }, [historyData, user, dismissedCallId]);

  const acceptIncomingCall = useCallback(async () => {
    if (!incomingCall) return;
    const call = incomingCall;
    setDismissedCallId(call.id);
    try {
      const updated = await updateStatusMutation.mutateAsync({
        id: call.id,
        data: { status: "ongoing" },
      });
      const caller = await getUserById(call.callerId);
      const callerLocalName = contacts?.find(
        (c) => c.pocketNumber === caller.pocketNumber,
      )?.localName;
      setActiveCall({
        call: updated,
        peer: {
          peerId: caller.id,
          peerName: callerLocalName ?? caller.pocketNumber,
          peerPocketNumber: caller.pocketNumber,
        },
      });
    } catch {
      // Best-effort — if this fails the incoming overlay simply closes.
    }
  }, [incomingCall, updateStatusMutation]);

  const rejectIncomingCall = useCallback(() => {
    if (!incomingCall) return;
    setDismissedCallId(incomingCall.id);
    updateStatusMutation.mutate({ id: incomingCall.id, data: { status: "declined" } });
  }, [incomingCall, updateStatusMutation]);

  const startCall = useCallback(
    async (peer: CallPeer) => {
      setError(null);
      try {
        const call = await startCallMutation.mutateAsync({ data: { receiverId: peer.peerId } });
        setActiveCall({ call, peer });
      } catch (err: any) {
        setError(err?.data?.error ?? err?.message ?? "تعذّر بدء الاتصال");
        throw err;
      }
    },
    [startCallMutation],
  );

  const startCallByPocketNumber = useCallback(
    async (pocketNumber: string) => {
      setError(null);
      try {
        const target = await searchUsers({ q: pocketNumber });
        const targetLocalName = contacts?.find(
          (c) => c.pocketNumber === target.pocketNumber,
        )?.localName;
        await startCall({
          peerId: target.id,
          peerName: targetLocalName ?? target.pocketNumber,
          peerPocketNumber: target.pocketNumber,
        });
      } catch (err: any) {
        setError(err?.data?.error ?? err?.message ?? "لم يُعثر على هذا الرقم");
        throw err;
      }
    },
    [startCall],
  );

  const endCall = useCallback(() => {
    setActiveCall((current) => {
      if (!current) return null;
      // Forward-only lifecycle: ringing -> declined (cancelled before pickup),
      // ongoing -> ended. Fire-and-forget; optimistically reflect the new
      // status locally so the overlay can show "Call ended" briefly instead
      // of vanishing instantly (see the terminal-state effect above).
      const nextStatus = current.call.status === "ongoing" ? "ended" : "declined";
      updateStatusMutation.mutate({ id: current.call.id, data: { status: nextStatus } });
      return { ...current, call: { ...current.call, status: nextStatus } };
    });
  }, [updateStatusMutation]);

  const clearError = useCallback(() => setError(null), []);
  const clearCall = useCallback(() => setActiveCall(null), []);

  return (
    <CallLauncherContext.Provider
      value={{
        activeCall,
        startCall,
        startCallByPocketNumber,
        endCall,
        clearCall,
        isStarting: startCallMutation.isPending,
        error,
        clearError,
        incomingCall,
        acceptIncomingCall,
        rejectIncomingCall,
      }}
    >
      {children}
    </CallLauncherContext.Provider>
  );
}

export function useCallLauncher() {
  const ctx = useContext(CallLauncherContext);
  if (!ctx) {
    throw new Error("useCallLauncher must be used within a CallLauncherProvider");
  }
  return ctx;
}
