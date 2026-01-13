import { json } from "../_lib/http.js";
import { hashPassword } from "../_lib/crypto.js";

function getProvidedToken(request) {
  // headers son case-insensitive
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
    // 1) Validar que exista secret (si no está aplicado aún, que no reviente)
    const expected = env.BOOTSTRAP_TOKEN;
    if (!expected) {
      return json({ error: "Missing BOOTSTRAP_TOKEN in environment (redeploy required)" }, 500);
    }

    const provided = getProvidedToken(request);
    if (!provided || provided !== expected) {
      return json({ error: "Invalid bootstrap token" }, 401);
    }

    // 2) Validar body JSON
    let body;
    try {
      body = await request.json();
    } catch {
      return json({ error: "Expected JSON" }, 400);
    }

    const email = String(body.email || "").trim().toLowerCase();
    const password = String(body.password || "");
    if (!email || !password) return json({ error: "Missing email/password" }, 400);

    // 3) D1 binding
    if (!env.DB) return json({ error: "Missing D1 binding (env.DB). Check Pages binding name = DB" }, 500);

    // 4) Solo permitir si users está vacío
    const row = await env.DB.prepare("SELECT COUNT(1) as n FROM users").first();
    const n = Number(row?.n || 0);
    if (n > 0) return json({ error: "Bootstrap already done" }, 409);

    // 5) Crear admin
    const password_hash = await hashPassword(password);
    const role = "admin";
    const plan = "pro";

    const r = await env.DB.prepare(
      "INSERT INTO users (email, password_hash, role, plan, expires_at, is_active) VALUES (?, ?, ?, ?, NULL, 1)"
    ).bind(email, password_hash, role, plan).run();

    const userId = r.meta?.last_row_id;
    await env.DB.prepare("INSERT INTO user_settings (user_id) VALUES (?)")
      .bind(userId)
      .run();

    return json({ ok: true, user: { id: userId, email, role, plan } }, 200);
  } catch (e) {
    console.error("BOOTSTRAP_CRASH:", e);
    return json({
      error: "Bootstrap crashed (see logs)",
      message: String(e?.message || e),
      stack: String(e?.stack || "")
    }, 500);
  }
}
