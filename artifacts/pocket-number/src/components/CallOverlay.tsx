import { PhoneOff, Mic, MicOff, Volume2, VolumeX, SignalHigh, SignalMedium, SignalLow } from "lucide-react";
import { useCallLauncher } from "@/contexts/CallLauncherContext";
import { useAuth } from "@/contexts/AuthContext";
import { useWebRTCCall } from "@/hooks/useWebRTCCall";
import {
  getCallDisplayState,
  getCallStatusLabel,
  formatCallDuration,
  isTerminalCallStatus,
  NETWORK_QUALITY_LABEL,
} from "@/lib/callDisplay";
import { cn } from "@/lib/utils";

/**
 * Full-screen overlay shown while a call is active (ringing/ongoing) and
 * briefly after it ends, so the user sees why (ended/missed/declined).
 * Once the call is "ongoing", this establishes the peer-to-peer WebRTC
 * audio connection (mic capture + signaling); the call lifecycle/status
 * itself is still owned entirely by CallLauncherContext + the REST API.
 */
export function CallOverlay() {
  const { activeCall, endCall } = useCallLauncher();
  const { user, token } = useAuth();

  const {
    audioRef,
    state: audioState,
    micError,
    notifyHangup,
    isMuted,
    toggleMute,
    isSpeakerOn,
    toggleSpeaker,
    networkQuality,
    elapsedSeconds,
  } = useWebRTCCall({
    call: activeCall?.call ?? null,
    peerId: activeCall?.peer.peerId ?? null,
    myUserId: user?.id ?? null,
    getToken: () => token,
  });

  if (!activeCall) return null;

  const { peer, call } = activeCall;
  const isCaller = call.callerId === user?.id;
  const isTerminal = isTerminalCallStatus(call.status);
  const displayState = getCallDisplayState({ callStatus: call.status, isCaller, audioState });
  const statusLabel = micError ? "تعذّر الوصول إلى الميكروفون" : getCallStatusLabel(displayState);
  const letter = peer.peerName.trim()[0]?.toUpperCase() ?? "؟";

  const handleHangUp = () => {
    notifyHangup();
    endCall();
  };

  const NetworkIcon =
    networkQuality === "good" ? SignalHigh : networkQuality === "fair" ? SignalMedium : SignalLow;

  return (
    <div className="fixed inset-0 z-50 flex justify-center bg-black/0">
      <div
        className={cn(
          "w-full max-w-[428px] h-full flex flex-col items-center justify-between py-16 px-8 animate-in fade-in duration-200",
          isTerminal
            ? "bg-gradient-to-b from-slate-600/95 to-slate-700"
            : "bg-gradient-to-b from-primary/95 to-primary",
        )}
      >
        <div className="flex flex-col items-center gap-3 mt-10">
          <span className="text-primary-foreground/80 text-sm font-medium">{statusLabel}</span>
          <div className="w-28 h-28 rounded-full bg-white/15 border-4 border-white/20 flex items-center justify-center">
            <span className="text-5xl font-black text-white">{letter}</span>
          </div>
          <p className="text-xl font-bold text-white mt-2">{peer.peerName}</p>
          <p className="text-sm font-mono text-white/70 tracking-wider" dir="ltr">
            {peer.peerPocketNumber}
          </p>

          {/* Call timer — only ticks once the WebRTC audio is actually connected. */}
          {displayState === "connected" || displayState === "reconnecting" ? (
            <p className="text-lg font-mono text-white/90 tracking-widest mt-1" dir="ltr">
              {formatCallDuration(elapsedSeconds)}
            </p>
          ) : null}

          {/* Network quality — derived only from RTCPeerConnection.connectionState, no extra polling/getStats. */}
          {networkQuality && !isTerminal && (
            <div className="flex items-center gap-1.5 mt-1 text-white/70">
              <NetworkIcon className="w-3.5 h-3.5" />
              <span className="text-xs font-medium">الشبكة: {NETWORK_QUALITY_LABEL[networkQuality]}</span>
            </div>
          )}
        </div>

        <div className="flex flex-col items-center gap-6">
          {/* Mute / speaker — only meaningful once audio is actually flowing. */}
          {!isTerminal && call.status === "ongoing" && (
            <div className="flex items-center gap-8">
              <button
                onClick={toggleMute}
                aria-label={isMuted ? "إلغاء كتم الميكروفون" : "كتم الميكروفون"}
                aria-pressed={isMuted}
                className={cn(
                  "w-14 h-14 rounded-full flex items-center justify-center transition-colors active:scale-95",
                  isMuted ? "bg-white text-primary" : "bg-white/15 text-white",
                )}
              >
                {isMuted ? <MicOff className="w-6 h-6" /> : <Mic className="w-6 h-6" />}
              </button>
              <button
                onClick={toggleSpeaker}
                aria-label={isSpeakerOn ? "إيقاف مكبر الصوت" : "تشغيل مكبر الصوت"}
                aria-pressed={isSpeakerOn}
                className={cn(
                  "w-14 h-14 rounded-full flex items-center justify-center transition-colors active:scale-95",
                  isSpeakerOn ? "bg-white text-primary" : "bg-white/15 text-white",
                )}
              >
                {isSpeakerOn ? <Volume2 className="w-6 h-6" /> : <VolumeX className="w-6 h-6" />}
              </button>
            </div>
          )}

          {/* End-call button — always visible while the call isn't already over. */}
          {!isTerminal && (
            <button
              onClick={handleHangUp}
              aria-label="إنهاء الاتصال"
              className="w-16 h-16 rounded-full bg-destructive flex items-center justify-center shadow-lg active:scale-95 transition-transform"
            >
              <PhoneOff className="w-7 h-7 text-white" />
            </button>
          )}
        </div>

        {/* Remote audio output — no visible UI, WebRTC audio only (no video). */}
        <audio ref={audioRef} autoPlay className="hidden" />
      </div>
    </div>
  );
}
