import { createContext, useCallback, useContext, useState, type ReactNode } from "react";
import { useStartCall, useUpdateCallStatus, searchUsers } from "@workspace/api-client-react";
import type { CallItem } from "@workspace/api-client-react";

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
}

const CallLauncherContext = createContext<CallLauncherState | null>(null);

export function CallLauncherProvider({ children }: { children: ReactNode }) {
  const [activeCall, setActiveCall] = useState<ActiveCall | null>(null);
  const [error, setError] = useState<string | null>(null);
  const startCallMutation = useStartCall();
  const updateStatusMutation = useUpdateCallStatus();

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
