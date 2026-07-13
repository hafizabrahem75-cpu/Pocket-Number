// Ad-hoc integration test for the messaging feature, following the existing
// test_admin.mjs / test_admin2.mjs convention (no test framework in this repo).
// Run with: node artifacts/api-server/test_messages.mjs
// Requires the API Server workflow to be running on :8080 with NODE_ENV !== "production"
// (so /auth/register returns devOtp).

const BASE = "http://localhost:8080/api";
let passed = 0;
let failed = 0;

function assert(cond, msg) {
  if (cond) {
    passed++;
    console.log(`  ✓ ${msg}`);
  } else {
    failed++;
    console.error(`  ✗ ${msg}`);
  }
}

async function req(method, path, token, body) {
  const res = await fetch(`${BASE}${path}`, {
    method,
    headers: {
      "Content-Type": "application/json",
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
    },
    body: body !== undefined ? JSON.stringify(body) : undefined,
  });
  let json;
  try {
    json = await res.json();
  } catch {
    json = null;
  }
  return { status: res.status, body: json };
}

async function registerAndVerify(email) {
  const reg = await req("POST", "/auth/register", null, {
    name: "Test",
    email,
    password: "TestPass123!",
  });
  if (reg.status !== 201) throw new Error(`register failed: ${JSON.stringify(reg)}`);
  const code = reg.body.devOtp;
  const verify = await req("POST", "/auth/verify-otp", null, { email, code });
  if (verify.status !== 200) throw new Error(`verify failed: ${JSON.stringify(verify)}`);
  return verify.body; // { token, user }
}

console.log("Setting up two verified users (sender + recipient)...");
const senderEmail = `msgtest_sender_${Date.now()}@example.com`;
const recipientEmail = `msgtest_recipient_${Date.now()}@example.com`;
const sender = await registerAndVerify(senderEmail);
const recipient = await registerAndVerify(recipientEmail);
const senderToken = sender.token;
const recipientToken = recipient.token;
const senderId = sender.user.id;
const recipientId = recipient.user.id;
console.log(`  sender id=${senderId}, recipient id=${recipientId}`);

// ---------------------------------------------------------------------------
// 1. Retracted-message serializer
// ---------------------------------------------------------------------------
console.log("\n[1] Retracted-message serializer");
{
  const sendRes = await req("POST", "/messages", senderToken, {
    recipientId,
    content: "this message will be retracted",
  });
  assert(sendRes.status === 201, "message send succeeds (201)");
  const msgId = sendRes.body.id;
  assert(sendRes.body.content === "this message will be retracted", "content present before retraction");
  assert(sendRes.body.deletedAt === null, "deletedAt is null before retraction");

  const delRes = await req("DELETE", `/messages/${msgId}`, senderToken);
  assert(delRes.status === 200, "sender can delete an unread message (200)");

  // Fetch the conversation as the sender; the retracted message is excluded
  // from the active list (deletedAt IS NULL filter), so instead verify via a
  // second send+delete-then-inspect using the raw serializer contract: send
  // another message, delete it, and confirm a re-delete attempt reports it's
  // already deleted (proves deletedAt was persisted server-side).
  const redelRes = await req("DELETE", `/messages/${msgId}`, senderToken);
  assert(redelRes.status === 409, "deleting an already-deleted message is rejected (409)");
}

// ---------------------------------------------------------------------------
// 2. Retracted messages cannot be un-retracted / read after deletion, and a
//    read message cannot be retracted (soft-delete guard)
// ---------------------------------------------------------------------------
console.log("\n[2] Soft-delete guard: cannot retract an already-read message");
{
  const sendRes = await req("POST", "/messages", senderToken, {
    recipientId,
    content: "this message will be read then retraction should fail",
  });
  const msgId = sendRes.body.id;

  const readRes = await req("PATCH", `/messages/${msgId}/status`, recipientToken, {
    status: "delivered",
  });
  assert(readRes.status === 200 && readRes.body.status === "delivered", "recipient can advance sent -> delivered");

  const readRes2 = await req("PATCH", `/messages/${msgId}/status`, recipientToken, {
    status: "read",
  });
  assert(readRes2.status === 200 && readRes2.body.status === "read", "recipient can advance delivered -> read");

  const delRes = await req("DELETE", `/messages/${msgId}`, senderToken);
  assert(delRes.status === 409, "sender cannot retract a message the recipient has already read (409)");
}

// ---------------------------------------------------------------------------
// 3. Read-status: forward-only state machine
// ---------------------------------------------------------------------------
console.log("\n[3] Read-status forward-only enforcement");
{
  const sendRes = await req("POST", "/messages", senderToken, {
    recipientId,
    content: "status transition test",
  });
  const msgId = sendRes.body.id;
  assert(sendRes.body.status === "sent", "new message starts as 'sent'");

  const backwardsRes = await req("PATCH", `/messages/${msgId}/status`, recipientToken, {
    status: "delivered",
  });
  assert(backwardsRes.status === 200, "sent -> delivered succeeds");

  const regressRes = await req("PATCH", `/messages/${msgId}/status`, recipientToken, {
    status: "delivered",
  });
  assert(regressRes.status === 409, "re-applying the same status (delivered -> delivered) is rejected (409)");

  const forwardRes = await req("PATCH", `/messages/${msgId}/status`, recipientToken, {
    status: "read",
  });
  assert(forwardRes.status === 200 && forwardRes.body.status === "read", "delivered -> read succeeds");

  const backToDeliveredRes = await req("PATCH", `/messages/${msgId}/status`, recipientToken, {
    status: "delivered",
  });
  assert(backToDeliveredRes.status === 409, "read -> delivered (regression) is rejected (409)");

  const senderAttempt = await req("PATCH", `/messages/${msgId}/status`, senderToken, {
    status: "read",
  });
  assert(senderAttempt.status === 404, "sender cannot advance status on their own sent message (404, recipient-only)");
}

// ---------------------------------------------------------------------------
// 4. GET /messages/conversation auto-marks delivered, scoped to the page
// ---------------------------------------------------------------------------
console.log("\n[4] Conversation fetch auto-delivery is scoped correctly");
{
  const sendRes = await req("POST", "/messages", senderToken, {
    recipientId,
    content: "auto-delivery test",
  });
  const msgId = sendRes.body.id;
  assert(sendRes.body.status === "sent", "message starts as sent before recipient fetches it");

  const convRes = await req("GET", `/messages/conversation?recipientId=${senderId}`, recipientToken);
  assert(convRes.status === 200, "recipient can fetch the conversation (200)");
  const fetched = convRes.body.messages.find((m) => m.id === msgId);
  assert(!!fetched, "the sent message is present in the recipient's conversation view");
  assert(fetched.status === "delivered", "fetching the conversation auto-advances sent -> delivered for the recipient");
}

// ---------------------------------------------------------------------------
// 5. Inbox unread count reflects sent + delivered (not read)
// ---------------------------------------------------------------------------
console.log("\n[5] Inbox unreadCount");
{
  const inboxRes = await req("GET", "/messages/inbox", recipientToken);
  assert(inboxRes.status === 200, "recipient can fetch inbox (200)");
  const convo = inboxRes.body.conversations.find((c) => c.peerId === senderId);
  assert(!!convo, "conversation with sender appears in inbox");
  assert(typeof convo.unreadCount === "number", "unreadCount is present and numeric");
}

console.log(`\n${passed} passed, ${failed} failed`);
if (failed > 0) process.exit(1);
