---
name: Pocket Number FCM push prep
description: Backend groundwork laid for future Android push notifications via FCM, before any Capacitor/Android app exists.
---

The notification foundation (device_tokens table, devices REST routes,
notifyNewMessage/notifyIncomingCall event hooks) already existed. Added an
FCM dispatch layer on top, scoped to Android only, fully inert until real
Firebase credentials exist:

- Reads `FCM_PROJECT_ID` / `FCM_CLIENT_EMAIL` / `FCM_PRIVATE_KEY` from env;
  `isFcmConfigured()` gates every call site.
- `notifyUser` sends only to `platform === "android"` device tokens through
  FCM when configured; otherwise unchanged log-only behavior. iOS/web
  tokens are intentionally left in the log-only path (not the current
  target).
- Prunes device tokens FCM reports as invalid/unregistered.
- No UI, no Capacitor/Android project, and no real Firebase secrets were
  added — those are still required before push actually works end to end.

**Why:** user explicitly wants Android push readiness "for later" without
requesting real Firebase credentials yet or touching message/call route
logic.

**How to apply:** when the Android app is eventually built, only 3 env vars
need to be set for real push to activate — no code changes required in
`notifyUser`/`notificationEvents.ts`.
