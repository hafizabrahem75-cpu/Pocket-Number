import { PhoneOff, Phone, MicOff } from "lucide-react";
import { useCallLauncher } from "@/contexts/CallLauncherContext";
import { useAuth } from "@/contexts/AuthContext";
import { useWebRTCCall } from "@/hooks/useWebRTCCall";

/**
 * Full-screen overlay shown while a call is active (ringing/ongoing).
 * Once the call is "ongoing", this establishes the peer-to-peer WebRTC
 * audio connection (mic capture + signaling); the call lifecycle/status
 * itself is still owned entirely by CallLauncherContext + the REST API.
 */
export function CallOverlay() {
  const { activeCall, endCall } = useCallLauncher();
  const { user, token } = useAuth();

  const { audioRef, state: audioState, micError, notifyHangup } = useWebRTCCall({
    call: activeCall?.call ?? null,
    peerId: activeCall?.peer.peerId ?? null,
    myUserId: user?.id ?? null,
    getToken: () => token,
  });

  if (!activeCall) return null;

  const { peer, call } = activeCall;
  const letter = peer.peerName.trim()[0]?.toUpperCase() ?? "؟";
  const statusLabel =
    call.status === "ongoing"
      ? audioState === "connected"
        ? "جارية الآن"
        : micError
          ? "تعذّر الوصول إلى الميكروفون"
          : "جارٍ توصيل الصوت…"
      : "جارٍ الاتصال…";

  const handleHangUp = () => {
    notifyHangup();
    endCall();
  };

  return (
    <div className="fixed inset-0 z-50 flex justify-center bg-black/0">
      <div className="w-full max-w-[428px] h-full bg-gradient-to-b from-primary/95 to-primary flex flex-col items-center justify-between py-16 px-8 animate-in fade-in duration-200">
        <div className="flex flex-col items-center gap-3 mt-10">
          <span className="text-primary-foreground/80 text-sm font-medium">{statusLabel}</span>
          <div className="w-28 h-28 rounded-full bg-white/15 border-4 border-white/20 flex items-center justify-center">
            <span className="text-5xl font-black text-white">{letter}</span>
          </div>
          <p className="text-xl font-bold text-white mt-2">{peer.peerName}</p>
          <p className="text-sm font-mono text-white/70 tracking-wider" dir="ltr">
            {peer.peerPocketNumber}
          </p>
        </div>

        <div className="flex flex-col items-center gap-4">
          {call.status === "ringing" && (
            <Phone className="w-6 h-6 text-white/60 animate-pulse" />
          )}
          {call.status === "ongoing" && micError && (
            <MicOff className="w-6 h-6 text-white/60" aria-label="تعذّر الوصول إلى الميكروفون" />
          )}
          <button
            onClick={handleHangUp}
            aria-label="إنهاء الاتصال"
            className="w-16 h-16 rounded-full bg-destructive flex items-center justify-center shadow-lg active:scale-95 transition-transform"
          >
            <PhoneOff className="w-7 h-7 text-white" />
          </button>
        </div>

        {/* Remote audio output — no visible UI, WebRTC audio only (no video). */}
        <audio ref={audioRef} autoPlay className="hidden" />
      </div>
    </div>
  );
}
