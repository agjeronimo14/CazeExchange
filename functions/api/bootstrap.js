import { json, err, getJsonBody } from "../_lib/http.js";
import { pbkdf2Hash } from "../_lib/crypto.js";

function getBootstrapToken(request, body) {
  // Prefer header for safety; also allow query/body for convenience.
  const h =
    request.headers.get("x-bootstrap-token") ||
    request.headers.get("X-Bootstrap-Token") ||
    request.headers.get("authorization") ||
    request.headers.get("Authorization") ||
    "";
  if (h.toLowerCase().startsWith("bearer ")) return h.slice(7).trim();

  const url = new URL(request.url);
  const q = url.searchParams.get("token") || "";

  const b = body && (body.bootstrap_token || body.token || "");

  return String(h || q || b || "").trim();
}

export async function onRequest(context) {
  if (context.request.method !== "POST") return err(405, "Method not allowed");

  const body = await getJsonBody(context.request);
  if (!body) return err(400, "Expected JSON");

  const required = String(context.env.BOOTSTRAP_TOKEN || "").trim();
  if (!required) return err(500, "Missing BOOTSTRAP_TOKEN env var");

  const provided = getBootstrapToken(context.request, body);
  if (!provided || provided !== required) return err(401, "Invalid bootstrap token");

  const db = context.env.DB;
  if (!db) return err(500, "Missing D1 binding (env.DB)");

  const row = await db.prepare("SELECT COUNT(1) as n FROM users").first();
  if (row && Number(row.n) > 0) return err(409, "Bootstrap already done");

  const email = String(body.email || "").trim().toLowerCase();
  const password = String(body.password || "").trim();
  if (!email.includes("@") || password.length < 6) return err(400, "Invalid email or password");

  const password_hash = await pbkdf2Hash(password);

  const res = await db
    .prepare(
      "INSERT INTO users (email, password_hash, role, plan, expires_at, is_active) VALUES (?, ?, 'admin', 'pro', NULL, 1)"
    )
    .bind(email, password_hash)
    .run();

  const userId = res.meta.last_row_id;
  await db.prepare("INSERT INTO user_settings (user_id) VALUES (?)").bind(userId).run();

  return json({ ok: true, user: { id: userId, email, role: "admin", plan: "pro" } });
}
