import { useEffect, useRef } from "react";
import { Capacitor } from "@capacitor/core";
import { PushNotifications } from "@capacitor/push-notifications";
import { registerDevice, unregisterDevice } from "@workspace/api-client-react";

/**
 * Registers an FCM push token for the current authenticated user on native
 * Android (Capacitor). This hook is a complete no-op in the browser — web
 * push is handled separately by useFcmToken.
 *
 * Lifecycle:
 *   mount   → request notification permission → register with FCM
 *             → receive token via "registration" event
 *             → POST /api/devices (platform: "android")
 *   unmount → DELETE /api/devices/:token + remove all push listeners
 *             (fires when the user logs out and HomeShell unmounts)
 *
 * Safe no-op when:
 *   - Not running inside a Capacitor native context (browser / dev server)
 *   - The user declines the notification permission prompt
 *
 * The hook never throws — all errors are caught and logged so a push
 * registration failure can never affect the app's core flow.
 */
export function useNativePush(): void {
  const registeredTokenRef = useRef<string | null>(null);

  useEffect(() => {
    // Only run on a real native Android/iOS build — not in the browser.
    if (!Capacitor.isNativePlatform()) return;

    let cancelled = false;

    async function registerNativePush() {
      try {
        // 1. Request permission. On Android 13+ this shows the system prompt;
        //    on older Android it is always granted automatically.
        const { receive } = await PushNotifications.requestPermissions();
        if (receive !== "granted" || cancelled) return;

        // 2. Trigger FCM registration. The token arrives asynchronously via
        //    the "registration" event below.
        await PushNotifications.register();
      } catch (err) {
        console.warn("[NativePush] Registration request failed:", err);
      }
    }

    // 3. Receive the FCM token and send it to the backend.
    const registrationListener = PushNotifications.addListener(
      "registration",
      async (token) => {
        if (cancelled) return;
        try {
          registeredTokenRef.current = token.value;
          await registerDevice({ token: token.value, platform: "android" });
        } catch (err) {
          console.warn("[NativePush] Backend device registration failed:", err);
        }
      },
    );

    // 4. Log registration errors — non-fatal.
    const errorListener = PushNotifications.addListener(
      "registrationError",
      (err) => {
        console.warn("[NativePush] FCM registration error:", err);
      },
    );

    registerNativePush();

    return () => {
      cancelled = true;

      // Remove FCM event listeners.
      void Promise.all([registrationListener, errorListener]).then((listeners) =>
        listeners.forEach((l) => l.remove()),
      );

      // Unregister the token from the backend (fire-and-forget on logout).
      const token = registeredTokenRef.current;
      if (!token) return;
      registeredTokenRef.current = null;
      unregisterDevice(token).catch(() => {});
    };
  }, []);
}
