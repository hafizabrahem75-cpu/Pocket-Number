import type { CallItem } from "@workspace/api-client-react";
import type { AudioConnectionState } from "@/hooks/useWebRTCCall";

/**
 * Frontend-only call presentation layer. Maps the backend call lifecycle
 * (CallItem.status: ringing/ongoing/ended/missed/declined — see
 * artifacts/api-server/src/routes/calls.ts) plus the local WebRTC audio
 * state into a single display state for the call UI.
 *
 * "busy" has no backend trigger yet (the API never returns it) — it is
 * prepared here so the UI already knows how to render it once a "busy"
 * transition is introduced server-side.
 */
export type CallDisplayState =
  | "calling"
  | "ringing"
  | "connecting"
  | "connected"
  | "reconnecting"
  | "ended"
  | "missed"
  | "no-answer" // caller's view when the receiver didn't pick up (server-side "missed")
  | "declined"
  | "busy";

export type NetworkQuality = "good" | "fair" | "poor";

/** How long (ms) the terminal-state overlay stays visible before auto-closing. */
export const TERMINAL_STATE_DISPLAY_MS = 2500;

const TERMINAL_CALL_STATUSES = new Set<CallItem["status"]>(["ended", "missed", "declined"]);

export function isTerminalCallStatus(status: CallItem["status"]): boolean {
  return TERMINAL_CALL_STATUSES.has(status);
}

export function getCallDisplayState(params: {
  callStatus: CallItem["status"];
  isCaller: boolean;
  audioState: AudioConnectionState;
}): CallDisplayState {
  const { callStatus, isCaller, audioState } = params;

  if (callStatus === "ended") return "ended";
  // "missed" from the caller's perspective means no-one answered — use a
  // separate label so the caller doesn't see the receiver's "مكالمة فائتة".
  if (callStatus === "missed") return isCaller ? "no-answer" : "missed";
  if (callStatus === "declined") return "declined";
  if (callStatus === "ringing") return isCaller ? "calling" : "ringing";

  // callStatus === "ongoing" — the call is live server-side; the audio
  // connection state drives the finer-grained UI.
  if (audioState === "connected") return "connected";
  if (audioState === "reconnecting") return "reconnecting";
  return "connecting";
}

const LABELS: Record<CallDisplayState, string> = {
  calling: "يتصل…",
  ringing: "مكالمة واردة",
  connecting: "جارٍ الاتصال…",
  connected: "جارية الآن",
  reconnecting: "إعادة الاتصال…",
  ended: "انتهت المكالمة",
  missed: "مكالمة فائتة",
  "no-answer": "لم يُجب",
  declined: "تم رفض المكالمة",
  busy: "الخط مشغول",
};

export function getCallStatusLabel(state: CallDisplayState): string {
  return LABELS[state];
}

export function formatCallDuration(totalSeconds: number): string {
  const safe = Math.max(0, Math.floor(totalSeconds));
  const m = Math.floor(safe / 60);
  const s = safe % 60;
  return `${String(m).padStart(2, "0")}:${String(s).padStart(2, "0")}`;
}

export const NETWORK_QUALITY_LABEL: Record<NetworkQuality, string> = {
  good: "جيدة",
  fair: "متوسطة",
  poor: "ضعيفة",
};
