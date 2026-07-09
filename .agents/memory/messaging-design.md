---
name: Messaging system design
description: Phase 3 backend — messages table schema, API routes, E2EE readiness, delivery state machine.
---

## Rule
The delivery status bulk-update in `GET /messages/conversation` MUST be scoped to the explicit message IDs returned on the current page. Never use a broad `WHERE sender_id=X AND recipient_id=Y AND status='sent'` — that would advance status on messages outside the cursor window (newer, unseen messages).

**Why:** Cursor-based pagination means a request for an older page should not affect messages the caller hasn't fetched yet. Using explicit IDs (via `id = ANY(...)`) keeps delivery semantics correct.

## E2EE readiness columns
The `messages` table already has `content_iv`, `content_tag`, `sender_public_key` (all nullable). Phase 2 only needs to:
1. Write real values to those columns when encrypting
2. Stop accepting plaintext `content` from clients (enforce ciphertext)
No schema migration needed.

## State machine
`sent → delivered → read` — forward-only. Only the recipient may advance the status. The PATCH `/messages/:id/status` endpoint enforces this via an `ORDER` map comparison.

## Soft-delete constraint
Sender may only delete a message that has NOT been read (`status !== 'read'`) and is not already deleted. Sets `deleted_at`; does not hard-delete.
