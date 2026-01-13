function json(data, status = 200) {
  return new Response(JSON.stringify(data), {
    status,
    headers: { "content-type": "application/json; charset=utf-8" },
  });
}

const te = new TextEncoder();

function randomBytes(n) {
  const a = new Uint8Array(n);
  crypto.getRandomValues(a);
  return a;
}
function b64(bytes) {
  return Buffer.from(bytes).toString("base64");
}

async function hashPassword(password, iterations = 120000) {
  const salt = randomBytes(16);
  const key = await crypto.subtle.importKey(
    "raw",
    te.encode(password),
    { name: "PBKDF2" },
    false,
    ["deriveBits"]
  );
  const bits = await crypto.subtle.deriveBits(
    { name: "PBKDF2", salt, iterations, hash: "SHA-256" },
    key,
    256
  );
  const hash = new Uint8Array(bits);
  return `pbkdf2$sha256$${iterations}$${b64(salt)}$${b64(hash)}`;
}

function getProvidedToken(request) {
  const h1 = request.headers.get("x-bootstrap-token");
  if (h1) return h1;
  const auth = request.headers.get("authorization");
  if (auth && auth.toLowerCase().startsWith("bearer ")) return auth.slice(7).trim();
  const url = new URL(request.url);
  const q = url.searchParams.get("token");
  if (q) return q;
  return null;
}

export async function onRequestPost({ request, env }) {
  try {
    const expected = env.BOOTSTRAP_TOKEN;
    if (!expected) return json({ error: "Missing BOOTSTRAP_TOKEN (redeploy required)" }, 500);

    const provided = getProvidedToken(request);
    if (!provided || provided !== expected) return json({ error: "Invalid bootstrap token" }, 401);

    let body;
    try { body = await request.json(); } catch { return json({ error: "Expected JSON" }, 400); }

    const email = String(body.email || "").trim().toLowerCase();
    const password = String(body.password || "");
    if (!email || !password) return json({ error: "Missing email/password" }, 400);

    if (!env.DB) return json({ error: "Missing D1 binding env.DB (Pages binding name must be DB)" }, 500);

    const row = await env.DB.prepare("SELECT COUNT(1) as n FROM users").first();
    const n = Number(row?.n || 0);
    if (n > 0) return json({ error: "Bootstrap already done" }, 409);

    const password_hash = await hashPassword(password);

    const r = await env.DB.prepare(
      "INSERT INTO users (email, password_hash, role, plan, expires_at, is_active) VALUES (?, ?, 'admin', 'pro', NULL, 1)"
    ).bind(email, password_hash).run();

    const userId = r.meta?.last_row_id;
    await env.DB.prepare("INSERT INTO user_settings (user_id) VALUES (?)").bind(userId).run();

    return json({ ok: true, user: { id: userId, email, role: "admin", plan: "pro" } }, 200);
  } catch (e) {
    console.error("BOOTSTRAP_CRASH:", e);
    return json({ error: "Bootstrap crashed", message: String(e?.message || e), stack: String(e?.stack || "") }, 500);
  }
}
