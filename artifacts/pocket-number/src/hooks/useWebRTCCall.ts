import { useCallback, useEffect, useRef, useState } from "react";
import type { CallItem } from "@workspace/api-client-react";

/**
 * Peer-to-peer WebRTC audio for an ongoing call.
 *
 * This only handles the audio transport (mic capture, RTCPeerConnection,
 * signaling over a WebSocket relay). The call lifecycle/status
 * (ringing/ongoing/ended/missed/declined) is entirely owned by
 * CallLauncherContext + the REST /calls endpoints — this hook never reads or
 * writes call status itself, and never ends the call: a degraded/dropped
 * ICE connection is retried in place instead.
 */

export type AudioConnectionState =
  | "idle"
  | "requesting-mic"
  | "connecting"
  | "connected"
  | "reconnecting"
  | "failed";

export type NetworkQuality = "good" | "fair" | "poor";

interface UseWebRTCCallOptions {
  /** The active call, or null when there is nothing to connect. */
  call: CallItem | null;
  /** The other participant's user id. */
  peerId: number | null;
  /** Current authenticated user's id. */
  myUserId: number | null;
  /** Getter for the current auth token (same one used for REST calls). */
  getToken: () => string | null;
}

const ICE_SERVERS: RTCIceServer[] = [{ urls: "stun:stun.l.google.com:19302" }];

// How long a "disconnected" connection is given to recover on its own before
// an ICE restart is attempted, and the overall grace window for retries
// before we stop trying (the call itself is never ended automatically).
const RETRY_CHECK_MS = 3000;
const MAX_RETRY_WINDOW_MS = 15000;

function buildSignalingUrl(token: string): string {
  const protocol = window.location.protocol === "https:" ? "wss:" : "ws:";
  return `${protocol}//${window.location.host}/api/ws/calls?token=${encodeURIComponent(token)}`;
}

/** Map WebRTC connection state to a coarse, cheap-to-compute quality label. */
function qualityFromConnectionState(state: RTCPeerConnectionState): NetworkQuality {
  switch (state) {
    case "connected":
      return "good";
    case "new":
    case "connecting":
      return "fair";
    default: // "disconnected" | "failed" | "closed"
      return "poor";
  }
}

export function useWebRTCCall({ call, peerId, myUserId, getToken }: UseWebRTCCallOptions) {
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const pcRef = useRef<RTCPeerConnection | null>(null);
  const wsRef = useRef<WebSocket | null>(null);
  const localStreamRef = useRef<MediaStream | null>(null);
  const pendingCandidatesRef = useRef<RTCIceCandidateInit[]>([]);
  const activeCallIdRef = useRef<number | null>(null);
  const isOffererRef = useRef(false);

  const retryTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const disconnectedSinceRef = useRef<number | null>(null);

  const connectedAtRef = useRef<number | null>(null);
  const timerIntervalRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const [state, setState] = useState<AudioConnectionState>("idle");
  const [micError, setMicError] = useState<string | null>(null);
  const [isMuted, setIsMuted] = useState(false);
  const [isSpeakerOn, setIsSpeakerOn] = useState(true);
  const [networkQuality, setNetworkQuality] = useState<NetworkQuality | null>(null);
  const [elapsedSeconds, setElapsedSeconds] = useState(0);

  const stopTimer = () => {
    if (timerIntervalRef.current) {
      clearInterval(timerIntervalRef.current);
      timerIntervalRef.current = null;
    }
    connectedAtRef.current = null;
    setElapsedSeconds(0);
  };

  const clearRetryTimer = () => {
    if (retryTimerRef.current) {
      clearTimeout(retryTimerRef.current);
      retryTimerRef.current = null;
    }
  };

  const cleanup = () => {
    clearRetryTimer();
    disconnectedSinceRef.current = null;
    stopTimer();

    wsRef.current?.close();
    wsRef.current = null;

    pcRef.current?.close();
    pcRef.current = null;

    localStreamRef.current?.getTracks().forEach((track) => track.stop());
    localStreamRef.current = null;

    pendingCandidatesRef.current = [];
    activeCallIdRef.current = null;
    isOffererRef.current = false;

    setIsMuted(false);
    setIsSpeakerOn(true);
    setNetworkQuality(null);

    if (audioRef.current) {
      audioRef.current.srcObject = null;
    }
  };

  useEffect(() => {
    const shouldConnect = call && call.status === "ongoing" && peerId && myUserId;

    if (!shouldConnect) {
      if (activeCallIdRef.current !== null) {
        cleanup();
        setState("idle");
      }
      return;
    }

    if (activeCallIdRef.current === call!.id) {
      return; // already connected/connecting for this call
    }

    activeCallIdRef.current = call!.id;
    let cancelled = false;

    async function connect() {
      setMicError(null);
      setState("requesting-mic");

      let stream: MediaStream;
      try {
        stream = await navigator.mediaDevices.getUserMedia({ audio: true, video: false });
      } catch (err: any) {
        if (cancelled) return;
        setMicError(err?.message ?? "تعذّر الوصول إلى الميكروفون");
        setState("failed");
        return;
      }

      if (cancelled) {
        stream.getTracks().forEach((track) => track.stop());
        return;
      }

      localStreamRef.current = stream;
      setState("connecting");
      setNetworkQuality("fair");

      const token = getToken();
      if (!token) {
        setMicError("انتهت الجلسة");
        setState("failed");
        return;
      }

      const pc = new RTCPeerConnection({ iceServers: ICE_SERVERS });
      pcRef.current = pc;

      stream.getTracks().forEach((track) => pc.addTrack(track, stream));

      pc.ontrack = (event) => {
        if (audioRef.current) {
          audioRef.current.srcObject = event.streams[0] ?? null;
        }
      };

      const ws = new WebSocket(buildSignalingUrl(token));
      wsRef.current = ws;

      const isOfferer = call!.callerId === myUserId;
      isOffererRef.current = isOfferer;

      /**
       * Attempt to recover a degraded connection in place rather than
       * ending the call. Only the offerer renegotiates (avoids glare); the
       * answerer just waits for the resulting offer and answers normally.
       * Retries stop after MAX_RETRY_WINDOW_MS — at that point the UI keeps
       * showing "poor" network quality but never tears down the call itself.
       */
      const attemptIceRestart = async () => {
        if (cancelled || pcRef.current !== pc) return;

        const since = disconnectedSinceRef.current;
        if (since !== null && Date.now() - since > MAX_RETRY_WINDOW_MS) {
          return; // give up retrying; leave quality indicator at "poor"
        }

        if (isOffererRef.current && ws.readyState === WebSocket.OPEN) {
          try {
            const offer = await pc.createOffer({ iceRestart: true });
            await pc.setLocalDescription(offer);
            ws.send(
              JSON.stringify({ type: "offer", callId: call!.id, targetUserId: peerId, sdp: offer }),
            );
          } catch {
            // best-effort; fall through to re-check on the next tick
          }
        }

        clearRetryTimer();
        retryTimerRef.current = setTimeout(() => {
          const cs = pcRef.current?.connectionState;
          if (cs === "disconnected" || cs === "failed") {
            void attemptIceRestart();
          }
        }, RETRY_CHECK_MS);
      };

      pc.onconnectionstatechange = () => {
        if (cancelled || pcRef.current !== pc) return;
        const cs = pc.connectionState;
        setNetworkQuality(qualityFromConnectionState(cs));

        if (cs === "connected") {
          setState("connected");
          clearRetryTimer();
          disconnectedSinceRef.current = null;
          if (connectedAtRef.current === null) {
            connectedAtRef.current = Date.now();
            timerIntervalRef.current = setInterval(() => {
              if (connectedAtRef.current !== null) {
                setElapsedSeconds(Math.floor((Date.now() - connectedAtRef.current) / 1000));
              }
            }, 1000);
          }
        } else if (cs === "disconnected") {
          // Transient — brief network hiccups resolve on their own often
          // enough that we don't want to alarm the user immediately.
          if (disconnectedSinceRef.current === null) disconnectedSinceRef.current = Date.now();
          setState("reconnecting");
          clearRetryTimer();
          retryTimerRef.current = setTimeout(() => void attemptIceRestart(), RETRY_CHECK_MS);
        } else if (cs === "failed") {
          if (disconnectedSinceRef.current === null) disconnectedSinceRef.current = Date.now();
          setState("reconnecting");
          void attemptIceRestart();
        } else if (cs === "closed") {
          setState("failed");
        }
      };

      pc.onicecandidate = (event) => {
        if (event.candidate && ws.readyState === WebSocket.OPEN) {
          ws.send(
            JSON.stringify({
              type: "ice-candidate",
              callId: call!.id,
              targetUserId: peerId,
              candidate: event.candidate,
            }),
          );
        }
      };

      ws.onopen = async () => {
        if (cancelled || !isOfferer) return;
        const offer = await pc.createOffer();
        await pc.setLocalDescription(offer);
        ws.send(
          JSON.stringify({ type: "offer", callId: call!.id, targetUserId: peerId, sdp: offer }),
        );
      };

      ws.onmessage = async (event) => {
        if (cancelled) return;
        let data: any;
        try {
          data = JSON.parse(event.data);
        } catch {
          return;
        }

        if (data.type === "offer") {
          await pc.setRemoteDescription(new RTCSessionDescription(data.sdp));
          for (const candidate of pendingCandidatesRef.current) {
            await pc.addIceCandidate(new RTCIceCandidate(candidate));
          }
          pendingCandidatesRef.current = [];
          const answer = await pc.createAnswer();
          await pc.setLocalDescription(answer);
          ws.send(
            JSON.stringify({ type: "answer", callId: call!.id, targetUserId: peerId, sdp: answer }),
          );
        } else if (data.type === "answer") {
          await pc.setRemoteDescription(new RTCSessionDescription(data.sdp));
          for (const candidate of pendingCandidatesRef.current) {
            await pc.addIceCandidate(new RTCIceCandidate(candidate));
          }
          pendingCandidatesRef.current = [];
        } else if (data.type === "ice-candidate" && data.candidate) {
          if (pc.remoteDescription) {
            await pc.addIceCandidate(new RTCIceCandidate(data.candidate));
          } else {
            pendingCandidatesRef.current.push(data.candidate);
          }
        } else if (data.type === "hangup") {
          cleanup();
          setState("idle");
        }
      };

      ws.onerror = () => {
        if (!cancelled) setState("failed");
      };
    }

    void connect();

    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [call?.id, call?.status, peerId, myUserId]);

  // Full teardown on unmount.
  useEffect(() => cleanup, []);

  /** Best-effort notice to the peer that we're hanging up (in addition to the REST status update). */
  const notifyHangup = () => {
    const ws = wsRef.current;
    const currentCall = call;
    if (ws && ws.readyState === WebSocket.OPEN && currentCall && peerId) {
      ws.send(JSON.stringify({ type: "hangup", callId: currentCall.id, targetUserId: peerId }));
    }
  };

  const toggleMute = useCallback(() => {
    setIsMuted((prev) => {
      const next = !prev;
      localStreamRef.current?.getAudioTracks().forEach((track) => {
        track.enabled = !next;
      });
      return next;
    });
  }, []);

  const toggleSpeaker = useCallback(() => {
    setIsSpeakerOn((prev) => {
      const next = !prev;
      void applySpeakerPreference(audioRef.current, next);
      return next;
    });
  }, []);

  return {
    audioRef,
    state,
    micError,
    notifyHangup,
    isMuted,
    toggleMute,
    isSpeakerOn,
    toggleSpeaker,
    networkQuality,
    elapsedSeconds,
  };
}

/**
 * Best-effort speaker routing. `setSinkId` is only supported on some
 * browsers (e.g. Chrome/Android) and requires an explicit audio output
 * device; where it isn't available the toggle still updates the UI but has
 * no effect on routing (desktop browsers already default to speaker).
 */
async function applySpeakerPreference(audio: HTMLAudioElement | null, speakerOn: boolean): Promise<void> {
  const el = audio as (HTMLAudioElement & { setSinkId?: (id: string) => Promise<void> }) | null;
  if (!el || typeof el.setSinkId !== "function") return;

  try {
    if (!speakerOn) {
      await el.setSinkId("default");
      return;
    }
    const devices = await navigator.mediaDevices.enumerateDevices();
    const speaker = devices.find((d) => d.kind === "audiooutput" && /speaker/i.test(d.label));
    await el.setSinkId(speaker ? speaker.deviceId : "default");
  } catch {
    // Ignore — unsupported browser/permission, toggle stays visual-only.
  }
}
