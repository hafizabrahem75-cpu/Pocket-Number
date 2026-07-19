import { useEffect, useRef } from "react";
import { getToken, deleteToken } from "firebase/messaging";
import {
  isFcmClientConfigured,
  getFirebaseMessaging,
  getFirebaseConfig,
  vapidKey,
} from "@/lib/firebase";
import { registerDevice, unregisterDevice } from "@workspace/api-client-react";

/**
 * Registers an FCM push token for the current authenticated user.
 *
 * Lifecycle:
 *   mount   → request notification permission → get FCM token
 *             → POST /api/devices (platform: "web")
 *   unmount → DELETE /api/devices/:token + revoke token from Firebase
 *             (fires when the user logs out and HomeShell unmounts)
 *
 * Safe no-op when:
 *   - Any VITE_FIREBASE_* env var is missing (FCM not configured)
 *   - The browser doesn't support service workers or Notifications API
 *   - The user declines the notification permission prompt
 *
 * The hook never throws — all errors are caught and logged to the console
 * so a push-registration failure can never affect the app's core flow.
 */
export function useFcmToken(): void {
  const registeredTokenRef = useRef<string | null>(null);

  useEffect(() => {
    // Guard: all VITE_ vars must be present.
    if (!isFcmClientConfigured()) return;
    // Guard: browser must support the required APIs.
    if (!("serviceWorker" in navigator) || !("Notification" in window)) return;

    let cancelled = false;

    async function registerFcmToken() {
      try {
        // 1. Register (or retrieve the existing registration for) the FCM
        //    service worker. The SW handles background push messages.
        const swUrl = new URL(
          "firebase-messaging-sw.js",
          window.location.origin + import.meta.env.BASE_URL,
        ).href;

        const swReg = await navigator.serviceWorker.register(swUrl, {
          scope: import.meta.env.BASE_URL,
        });

        // 2. Send Firebase config to the SW so it can initialise Firebase
        //    on its side (SWs can't read Vite env vars directly).
        const sendConfig = (sw: ServiceWorker | null) => {
          if (!sw) return;
          sw.postMessage({ type: "FIREBASE_CONFIG", config: getFirebaseConfig() });
        };
        sendConfig(swReg.installing ?? swReg.waiting ?? swReg.active);
        // Also make sure the active SW gets the config after it becomes ready.
        navigator.serviceWorker.ready.then((reg) => sendConfig(reg.active));

        // 3. Ask for notification permission. The prompt only appears once;
        //    subsequent calls resolve immediately with the stored answer.
        const permission = await Notification.requestPermission();
        if (permission !== "granted" || cancelled) return;

        // 4. Get (or refresh) the FCM registration token.
        const messaging = getFirebaseMessaging();
        const token = await getToken(messaging, {
          vapidKey,
          serviceWorkerRegistration: swReg,
        });

        if (!token || cancelled) return;

        // 5. Register the token with our backend so the server knows where
        //    to send push notifications for this user.
        registeredTokenRef.current = token;
        await registerDevice({ token, platform: "web" });
      } catch (err) {
        console.warn("[FCM] Token registration failed:", err);
      }
    }

    registerFcmToken();

    return () => {
      cancelled = true;

      const token = registeredTokenRef.current;
      if (!token) return;
      registeredTokenRef.current = null;

      // Unregister from the backend (fire-and-forget — user is logging out).
      unregisterDevice(token).catch(() => {});

      // Revoke the token from Firebase so it can't be used again until
      // the next login.
      try {
        deleteToken(getFirebaseMessaging()).catch(() => {});
      } catch {
        // getFirebaseMessaging() can throw if the app was never initialised.
      }
    };
  }, []);
}
