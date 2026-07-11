import { createContext, useCallback, useContext, useMemo, useState, type ReactNode } from "react";
import {
  useStartCall,
  useUpdateCallStatus,
  useGetCallHistory,
  getGetCallHistoryQueryKey,
  searchUsers,
  getUserById,
} from "@workspace/api-client-react";
import type { CallItem } from "@workspace/api-client-react";
import { useAuth } from "@/contexts/AuthContext";

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

  // Poll call history for a ringing call placed by someone else to this user.
  // No WebSocket/push exists yet, so short polling mirrors the pattern already
  // used for messages (see MessagesTab).
  const { data: historyData } = useGetCallHistory(undefined, {
    query: { queryKey: getGetCallHistoryQueryKey(undefined), enabled: !!user, refetchInterval: 3000 },
  });

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
      setActiveCall({
        call: updated,
        peer: { peerId: caller.id, peerName: caller.name, peerPocketNumber: caller.pocketNumber },
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
        await startCall({
          peerId: target.id,
          peerName: target.name,
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
      if (current) {
        // Forward-only lifecycle: ringing -> declined (cancelled before pickup),
        // ongoing -> ended. Fire-and-forget; UI already closes the overlay.
        const nextStatus = current.call.status === "ongoing" ? "ended" : "declined";
        updateStatusMutation.mutate({ id: current.call.id, data: { status: nextStatus } });
      }
      return null;
    });
  }, [updateStatusMutation]);

  const clearError = useCallback(() => setError(null), []);

  return (
    <CallLauncherContext.Provider
      value={{
        activeCall,
        startCall,
        startCallByPocketNumber,
        endCall,
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
