import { useEffect, useRef } from "react";
import type { CallItem } from "@workspace/api-client-react";

/**
 * useCallTones — V1 audio/haptic feedback for the calling UI.
 *
 * Responsible for:
 *  - Incoming ringtone: looping double-ring pattern while an incoming call
 *    is waiting (incomingCall present, not yet accepted/rejected).
 *  - Outgoing ringback: looping tone while the caller waits for pickup
 *    (activeCall.call.status === "ringing" and current user is the caller).
 *  - Vibration: repeating pattern for incoming calls via navigator.vibrate().
 *
 * Intentionally NOT responsible for:
 *  - WebRTC audio transport (useWebRTCCall owns that).
 *  - Volume/ringtone settings (future feature).
 *  - Notification sounds for background calls (requires push + service worker).
 *
 * ── Android APK readiness ──────────────────────────────────────────────────
 * In a Capacitor/Cordova APK, swap the Web Audio synthesis for native APIs:
 *   - Ringtone  → RingtoneManager.getDefaultUri(TYPE_RINGTONE)
 *   - Ringback  → AudioManager.STREAM_VOICE_CALL + MediaPlayer
 *   - Vibration → Vibrator.createWaveform() / VibrationEffect
 * The mode enum ("incoming" | "outgoing" | "none") maps directly to those
 * native branches; keep the interface here stable so the swap is mechanical.
 * ──────────────────────────────────────────────────────────────────────────
 */

// ── Tone parameters ────────────────────────────────────────────────────────

/** North American telephone ring frequencies (NANP standard). */
const RING_FREQ_1 = 440; // Hz
const RING_FREQ_2 = 480; // Hz

/** Master amplitude (0–1). Low enough to not startle; high enough to hear
 *  on a mobile speaker through a pocket. Future settings UI maps to this. */
const AMPLITUDE = 0.28;

/**
 * Incoming ring loop: classic double-burst pattern.
 * Total loop length: 4 s  (feels like a real phone ringing at ~15 rings/min).
 *
 * [0.0 – 0.4 s]  tone  (burst 1)
 * [0.4 – 0.8 s]  silence
 * [0.8 – 1.2 s]  tone  (burst 2)
 * [1.2 – 4.0 s]  silence  (gap before next ring)
 */
const RING_BUFFER_DURATION_S = 4.0;
const RING_SEGMENTS: ToneSegment[] = [
  { startS: 0.0, durationS: 0.4 },
  { startS: 0.8, durationS: 0.4 },
];

/**
 * Outgoing ringback loop: single long tone + pause.
 * Total loop length: 6 s  (matches the cadence the caller hears on PSTN).
 *
 * [0.0 – 2.0 s]  tone
 * [2.0 – 6.0 s]  silence
 */
const RINGBACK_BUFFER_DURATION_S = 6.0;
const RINGBACK_SEGMENTS: ToneSegment[] = [
  { startS: 0.0, durationS: 2.0 },
];

/**
 * Vibration pattern for incoming calls.
 * Expressed as [on, off, on, off, …] milliseconds.
 * 20 repetitions ≈ 50 s — longer than any realistic ring timeout.
 */
const VIBRATION_PATTERN_MS: number[] = Array.from({ length: 20 }, () => [1000, 500]).flat();

// ── Types ──────────────────────────────────────────────────────────────────

interface ToneSegment {
  startS: number;
  durationS: number;
}

type ToneMode = "incoming" | "outgoing" | "none";

interface UseCallTonesOptions {
  incomingCall: CallItem | null;
  activeCall: { call: CallItem; peer: { peerId: number } } | null;
  myUserId: number | null;
}

// ── Buffer synthesis ───────────────────────────────────────────────────────

/**
 * Render a loopable mono AudioBuffer from a list of active tone segments.
 * Each segment applies a short (3 ms) linear fade in/out to prevent audible
 * clicks at the segment boundaries.
 */
function renderToneBuffer(
  ctx: AudioContext,
  durationS: number,
  segments: ToneSegment[],
): AudioBuffer {
  const sr = ctx.sampleRate;
  const totalSamples = Math.ceil(durationS * sr);
  const buffer = ctx.createBuffer(1, totalSamples, sr);
  const data = buffer.getChannelData(0);
  const fadeSamples = Math.floor(0.003 * sr); // 3 ms click-prevention fade

  for (const seg of segments) {
    const segStart = Math.floor(seg.startS * sr);
    const segEnd = Math.min(Math.floor((seg.startS + seg.durationS) * sr), totalSamples);

    for (let i = segStart; i < segEnd; i++) {
      const t = (i - segStart) / sr;

      // Linear fade-in/out envelope
      const fadeIn = i - segStart < fadeSamples ? (i - segStart) / fadeSamples : 1;
      const fadeOut = segEnd - i < fadeSamples ? (segEnd - i) / fadeSamples : 1;
      const envelope = fadeIn * fadeOut;

      // Two-frequency chord (standard telephone ring tone)
      const sample =
        (Math.sin(2 * Math.PI * RING_FREQ_1 * t) +
          Math.sin(2 * Math.PI * RING_FREQ_2 * t)) /
        2; // normalise to [-1, 1]

      data[i] = envelope * AMPLITUDE * sample;
    }
  }

  return buffer;
}

// ── Playback helpers ───────────────────────────────────────────────────────

/** Start a looping buffer and return a stop function. */
function startLoopingBuffer(ctx: AudioContext, buffer: AudioBuffer): () => void {
  const source = ctx.createBufferSource();
  source.buffer = buffer;
  source.loop = true;

  // Route through a GainNode so a future volume control can taper smoothly.
  const gain = ctx.createGain();
  gain.gain.setValueAtTime(1, ctx.currentTime);
  source.connect(gain);
  gain.connect(ctx.destination);
  source.start();

  return () => {
    try {
      // Short fade-out (20 ms) to prevent a click when stopping mid-wave.
      gain.gain.setTargetAtTime(0, ctx.currentTime, 0.007);
      source.stop(ctx.currentTime + 0.05);
    } catch {
      // Already stopped — safe to ignore.
    }
  };
}

/** Trigger vibration if the API is available (Android WebView / Chrome). */
function startVibration(): () => void {
  if (typeof navigator.vibrate !== "function") return () => {};
  navigator.vibrate(VIBRATION_PATTERN_MS);
  return () => navigator.vibrate(0);
}

// ── Main hook ──────────────────────────────────────────────────────────────

export function useCallTones({ incomingCall, activeCall, myUserId }: UseCallTonesOptions): void {
  // Lazily created AudioContext — kept alive for the session once created so
  // resume() calls are cheap and there is no re-synthesis overhead.
  const ctxRef = useRef<AudioContext | null>(null);

  // Pre-rendered buffers (created once per AudioContext).
  const ringBufferRef = useRef<AudioBuffer | null>(null);
  const ringbackBufferRef = useRef<AudioBuffer | null>(null);

  // Cleanup functions returned by the active playback.
  const stopAudioRef = useRef<(() => void) | null>(null);
  const stopVibrationRef = useRef<(() => void) | null>(null);

  // Track the last active mode so we only restart audio on actual transitions.
  const lastModeRef = useRef<ToneMode>("none");

  useEffect(() => {
    // ── Derive current mode ──────────────────────────────────────────────
    let mode: ToneMode = "none";

    if (incomingCall && !activeCall) {
      // Someone is calling us and we haven't acted on it yet.
      mode = "incoming";
    } else if (activeCall && activeCall.call.status === "ringing" && activeCall.call.callerId === myUserId) {
      // We placed a call and are waiting for the other side to pick up.
      mode = "outgoing";
    }

    // No change — nothing to do.
    if (mode === lastModeRef.current) return;
    lastModeRef.current = mode;

    // ── Stop whatever is currently playing ───────────────────────────────
    stopAudioRef.current?.();
    stopAudioRef.current = null;
    stopVibrationRef.current?.();
    stopVibrationRef.current = null;

    if (mode === "none") return;

    // ── Lazily create / resume the AudioContext ──────────────────────────
    // AudioContext must be created (or resumed) in response to user interaction.
    // By the time this code runs the user has already tapped something on-screen
    // (navigated to the home shell, or triggered the call), so resume() will
    // succeed in any compliant browser.
    //
    // APK note: on Android WebView, AudioContext behaves identically to Chrome.
    let ctx = ctxRef.current;
    if (!ctx) {
      ctx = new AudioContext();
      ctxRef.current = ctx;
    }
    // State may be "suspended" after a tab-visibility change — resume is
    // a no-op if already running.
    void ctx.resume();

    // ── Pre-render buffers on first use ──────────────────────────────────
    if (!ringBufferRef.current) {
      ringBufferRef.current = renderToneBuffer(ctx, RING_BUFFER_DURATION_S, RING_SEGMENTS);
    }
    if (!ringbackBufferRef.current) {
      ringbackBufferRef.current = renderToneBuffer(ctx, RINGBACK_BUFFER_DURATION_S, RINGBACK_SEGMENTS);
    }

    // ── Start the appropriate tone ───────────────────────────────────────
    if (mode === "incoming") {
      stopAudioRef.current = startLoopingBuffer(ctx, ringBufferRef.current);
      stopVibrationRef.current = startVibration();
    } else {
      // "outgoing" — ringback heard by the caller while waiting
      stopAudioRef.current = startLoopingBuffer(ctx, ringbackBufferRef.current);
      // No vibration for outgoing — the user initiated the call deliberately.
    }

    // ── Cleanup: stop audio/vibration if the component unmounts ─────────
    return () => {
      stopAudioRef.current?.();
      stopAudioRef.current = null;
      stopVibrationRef.current?.();
      stopVibrationRef.current = null;
      lastModeRef.current = "none";
    };
  }, [
    // Re-evaluate when the relevant call state changes.
    // We deliberately do not list the full objects — only the fields that
    // actually determine the mode, to avoid spurious restarts.
    incomingCall?.id,
    activeCall?.call.id,
    activeCall?.call.status,
    myUserId,
  ]);
}
