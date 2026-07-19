import { initializeApp, getApps, type FirebaseApp } from "firebase/app";
import { getMessaging, type Messaging } from "firebase/messaging";

/**
 * Firebase client-side initialisation — FCM token registration side.
 *
 * All five VITE_ vars must be present for FCM to activate in the browser.
 * When any is missing, `isFcmClientConfigured()` returns false and
 * `useFcmToken` becomes a complete no-op — no Firebase code ever executes.
 *
 * Required environment variables (set in Replit Secrets, prefix VITE_):
 *   VITE_FIREBASE_API_KEY
 *   VITE_FIREBASE_PROJECT_ID
 *   VITE_FIREBASE_MESSAGING_SENDER_ID
 *   VITE_FIREBASE_APP_ID
 *   VITE_FIREBASE_VAPID_KEY   ← Web Push certificate key pair (Firebase console)
 */

const {
  VITE_FIREBASE_API_KEY: apiKey,
  VITE_FIREBASE_PROJECT_ID: projectId,
  VITE_FIREBASE_MESSAGING_SENDER_ID: messagingSenderId,
  VITE_FIREBASE_APP_ID: appId,
  VITE_FIREBASE_VAPID_KEY: vapidKey,
} = import.meta.env;

export function isFcmClientConfigured(): boolean {
  return !!(apiKey && projectId && messagingSenderId && appId && vapidKey);
}

/** VAPID key for getToken() — exported so useFcmToken can read it once. */
export { vapidKey };

/** Config object passed to the messaging service worker via postMessage. */
export function getFirebaseConfig(): Record<string, string> {
  return { apiKey, projectId, messagingSenderId, appId };
}

// Singletons — created lazily on first real use so this module has zero
// overhead when FCM isn't configured.
let _app: FirebaseApp | null = null;
let _messaging: Messaging | null = null;

export function getFirebaseApp(): FirebaseApp {
  if (_app) return _app;
  _app = getApps()[0] ?? initializeApp({ apiKey, projectId, messagingSenderId, appId });
  return _app;
}

export function getFirebaseMessaging(): Messaging {
  if (_messaging) return _messaging;
  _messaging = getMessaging(getFirebaseApp());
  return _messaging;
}
