import { useEffect, useRef, useState } from "react";
import type { CallItem } from "@workspace/api-client-react";

/**
 * Peer-to-peer WebRTC audio for an ongoing call.
 *
 * This only handles the audio transport (mic capture, RTCPeerConnection,
 * signaling over a WebSocket relay). The call lifecycle/status
 * (ringing/ongoing/ended/missed/declined) is entirely owned by
 * CallLauncherContext + the REST /calls endpoints — this hook never reads or
 * writes call status itself.
 */

export type AudioConnectionState = "idle" | "requesting-mic" | "connecting" | "connected" | "failed";

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

function buildSignalingUrl(token: string): string {
  const protocol = window.location.protocol === "https:" ? "wss:" : "ws:";
  return `${protocol}//${window.location.host}/api/ws/calls?token=${encodeURIComponent(token)}`;
}

export function useWebRTCCall({ call, peerId, myUserId, getToken }: UseWebRTCCallOptions) {
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const pcRef = useRef<RTCPeerConnection | null>(null);
  const wsRef = useRef<WebSocket | null>(null);
  const localStreamRef = useRef<MediaStream | null>(null);
  const pendingCandidatesRef = useRef<RTCIceCandidateInit[]>([]);
  const activeCallIdRef = useRef<number | null>(null);

  const [state, setState] = useState<AudioConnectionState>("idle");
  const [micError, setMicError] = useState<string | null>(null);

  const cleanup = () => {
    wsRef.current?.close();
    wsRef.current = null;

    pcRef.current?.close();
    pcRef.current = null;

    localStreamRef.current?.getTracks().forEach((track) => track.stop());
    localStreamRef.current = null;

    pendingCandidatesRef.current = [];
    activeCallIdRef.current = null;

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

      pc.onconnectionstatechange = () => {
        if (cancelled) return;
        if (pc.connectionState === "connected") setState("connected");
        if (pc.connectionState === "failed" || pc.connectionState === "closed") setState("failed");
      };

      const ws = new WebSocket(buildSignalingUrl(token));
      wsRef.current = ws;

      const isOfferer = call!.callerId === myUserId;

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

  return { audioRef, state, micError, notifyHangup };
}
