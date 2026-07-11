const BASE = "http://localhost:8080/api";

async function registerAndVerify(email) {
  const regRes = await fetch(`${BASE}/auth/register`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ name: "Test", email, password: "TestPass123!" }),
  });
  const reg = await regRes.json();
  const code = reg.devOtp;
  const verRes = await fetch(`${BASE}/auth/verify-otp`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ email, code }),
  });
  const verify = await verRes.json();
  if (!verRes.ok) throw new Error("verify failed: " + JSON.stringify(verify));
  return verify;
}

const admin = await registerAndVerify(`admintest_${Date.now()}@example.com`);
const plain = await registerAndVerify(`plaintest_${Date.now()}@example.com`);
console.log("admin id", admin.user.id, "plain id", plain.user.id);

globalThis.__adminId = admin.user.id;
globalThis.__plainId = plain.user.id;
globalThis.__adminToken = admin.token;
globalThis.__plainToken = plain.token;
