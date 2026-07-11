const BASE = "http://localhost:8080/api";

async function login(email, password) {
  const res = await fetch(`${BASE}/auth/login`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ email, password }),
  });
  return { status: res.status, body: await res.json() };
}

// re-login using stored creds from previous script isn't possible (lost), so re-register fresh users here instead.
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
  return verify;
}

const adminEmail = `admintest2_${Date.now()}@example.com`;
const plainEmail = `plaintest2_${Date.now()}@example.com`;
const admin = await registerAndVerify(adminEmail);
const plain = await registerAndVerify(plainEmail);
console.log("admin id", admin.user.id, "plain id", plain.user.id);
console.log(JSON.stringify({ adminId: admin.user.id, plainId: plain.user.id, adminToken: admin.token, plainToken: plain.token, adminEmail, plainEmail }));
