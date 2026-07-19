/**
 * Firebase Cloud Messaging service worker — handles push notifications when
 * the Pocket Number tab is in the background or closed.
 *
 * Firebase config is sent from the main page via postMessage immediately
 * after this SW is registered (see useFcmToken.ts). The SW initialises
 * Firebase and sets up the background message handler once it receives that
 * message.
 *
 * If a push arrives before the config message, the notification is silently
 * dropped — this is acceptable during initial setup and the client will
 * re-register on the next app open.
 */

importScripts("https://www.gstatic.com/firebasejs/10.12.0/firebase-app-compat.js");
importScripts("https://www.gstatic.com/firebasejs/10.12.0/firebase-messaging-compat.js");

let messagingInitialised = false;

self.addEventListener("message", (event) => {
  if (event.data?.type !== "FIREBASE_CONFIG") return;
  if (messagingInitialised) return;

  const config = event.data.config;
  if (!config?.apiKey || !config?.projectId) return;

  try {
    // Initialise Firebase inside the SW using the config received from
    // the main page (the SW cannot read Vite env vars directly).
    firebase.initializeApp(config);

    const messaging = firebase.messaging();

    // Background message handler — fires when a push arrives while the
    // app tab is not focused. Foreground messages are handled by the main
    // page via onMessage() in useFcmToken (if needed in future).
    messaging.onBackgroundMessage((payload) => {
      const title = payload.notification?.title ?? "Pocket Number";
      const body = payload.notification?.body ?? "";

      // data fields sent by notificationEvents.ts (type, senderId / callId)
      const data = payload.data ?? {};

      self.registration.showNotification(title, {
        body,
        icon: "/favicon.svg",
        badge: "/favicon.svg",
        tag: data.type === "call" ? `call-${data.callId}` : `msg-${data.senderId}`,
        data,
      });
    });

    messagingInitialised = true;
  } catch (err) {
    console.error("[FCM SW] Initialisation failed:", err);
  }
});

// Forward notification clicks to the app window.
self.addEventListener("notificationclick", (event) => {
  event.notification.close();

  event.waitUntil(
    clients
      .matchAll({ type: "window", includeUncontrolled: true })
      .then((clientList) => {
        // Focus an existing tab if open, otherwise open a new one.
        for (const client of clientList) {
          if ("focus" in client) return client.focus();
        }
        return clients.openWindow("/");
      }),
  );
});
