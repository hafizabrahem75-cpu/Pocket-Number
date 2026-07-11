---
name: Pocket Number WebRTC signaling
description: How peer-to-peer audio calling signaling was added without touching the call lifecycle/status system
---

Added a minimal WS-based WebRTC signaling relay for audio-only calls, kept fully separate from the existing REST call lifecycle (ringing/ongoing/ended/missed/declined in `calls` table + routes/calls.ts).

**Design:** signaling server only relays offer/answer/ICE JSON messages between the two participants of a non-terminal call; it never reads/writes call status itself. Auth reuses the existing JWT (`verifyToken`), passed as a `?token=` query param on the WS URL since browsers can't set custom WS handshake headers. Before relaying any message, the server re-verifies (via DB query) that sender+target are the two participants of a `ringing`/`ongoing` call — this is the only trust boundary and was verified with a negative test (a third user targeted mid-call receives nothing).

**Why:** keeps the call metadata system (which the user explicitly said not to touch) completely decoupled from the audio transport, so WebRTC can be added/removed without touching lifecycle code.

**How to apply:** if extending calls further (e.g. video, group calls), extend the signaling message `type` union and the DB participant check — don't add new REST endpoints for signaling itself, and don't let the signaling layer mutate call status.

**Gotcha:** `POST /auth/verify-otp` expects a `code` field, not `otp` — easy to guess wrong when writing test/debug scripts against this API.
