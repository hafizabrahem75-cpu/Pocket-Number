import { Phone, PhoneOff } from "lucide-react";
import { useGetUserById, useGetContacts, getGetUserByIdQueryKey } from "@workspace/api-client-react";
import { useCallLauncher } from "@/contexts/CallLauncherContext";
import { getCallStatusLabel } from "@/lib/callDisplay";

/**
 * Full-screen overlay shown when another user calls this user (status "ringing").
 * No WebRTC/audio — accepting/rejecting only updates call status via the API.
 */
export function IncomingCallOverlay() {
  const { incomingCall, acceptIncomingCall, rejectIncomingCall } = useCallLauncher();
  const { data: caller, isLoading } = useGetUserById(incomingCall?.callerId ?? -1, {
    query: { queryKey: getGetUserByIdQueryKey(incomingCall?.callerId ?? -1), enabled: !!incomingCall },
  });
  const { data: contacts } = useGetContacts();

  if (!incomingCall) return null;

  const contactName = caller && contacts?.find((c) => c.pocketNumber === caller.pocketNumber)?.localName;
  const displayName = contactName || caller?.pocketNumber || "مكالمة واردة";
  const letter = displayName.trim()[0]?.toUpperCase() ?? "؟";

  return (
    <div className="fixed inset-0 z-50 flex justify-center bg-black/0">
      <div className="w-full max-w-[428px] h-full bg-gradient-to-b from-emerald-600/95 to-emerald-700 flex flex-col items-center justify-between py-16 px-8 animate-in fade-in duration-200">
        <div className="flex flex-col items-center gap-3 mt-10">
          <span className="text-white/80 text-sm font-medium">{getCallStatusLabel("ringing")}</span>
          <div className="w-28 h-28 rounded-full bg-white/15 border-4 border-white/20 flex items-center justify-center">
            <span className="text-5xl font-black text-white">{letter}</span>
          </div>
          {isLoading ? (
            <div className="h-6 w-32 bg-white/20 rounded animate-pulse mt-2" />
          ) : (
            <>
              <p className="text-xl font-bold text-white mt-2">{displayName}</p>
              {caller?.pocketNumber && (
                <p className="text-sm font-mono text-white/70 tracking-wider" dir="ltr">
                  {caller.pocketNumber}
                </p>
              )}
            </>
          )}
        </div>

        <div className="flex items-center justify-center gap-10">
          <div className="flex flex-col items-center gap-2">
            <button
              onClick={rejectIncomingCall}
              aria-label="رفض المكالمة"
              className="w-16 h-16 rounded-full bg-destructive flex items-center justify-center shadow-lg active:scale-95 transition-transform"
            >
              <PhoneOff className="w-7 h-7 text-white" />
            </button>
            <span className="text-xs text-white/80 font-medium">رفض</span>
          </div>
          <div className="flex flex-col items-center gap-2">
            <button
              onClick={acceptIncomingCall}
              aria-label="قبول المكالمة"
              className="w-16 h-16 rounded-full bg-emerald-400 flex items-center justify-center shadow-lg active:scale-95 transition-transform"
            >
              <Phone className="w-7 h-7 text-white" />
            </button>
            <span className="text-xs text-white/80 font-medium">قبول</span>
          </div>
        </div>
      </div>
    </div>
  );
}
