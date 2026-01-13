import { json, err, getJsonBody } from "../../_lib/http.js";
import { requireAdmin } from "../../_lib/auth.js";
import { pbkdf2Hash, randomToken } from "../../_lib/crypto.js";

function normalizeRole(role) {
  const r = String(role || "").toLowerCase();
  if (["admin", "pro", "trial", "viewer"].includes(r)) return r;
  return null;
}

function normalizePlan(plan) {
  const p = String(plan || "").toLowerCase();
  if (!p) return "trial";
  if (["trial", "pro"].includes(p)) return p;
  return p; // allow custom labels if you want later
}

export async function onRequest(context) {
  if (context.request.method !== "POST") return err(405, "Method not allowed");

  const db = context.env.DB;
  if (!db) return err(500, "Missing D1 binding (env.DB)");

  const { response } = await requireAdmin(context);
  if (response) return response;

  const body = await getJsonBody(context.request);
  if (!body) return err(400, "Expected JSON");

  const email = String(body.email || "").trim().toLowerCase();
  const role = normalizeRole(body.role) || "trial";
  const plan = normalizePlan(body.plan);
  const expires_at = body.expires_at ? String(body.expires_at) : null;
  const is_active = body.is_active === false ? 0 : 1;

  if (!email.includes("@")) return err(400, "Invalid email");

  let password = String(body.password || "");
  if (!password) {
    // temp password (admin will send via WhatsApp)
    password = `CE-${randomToken(6)}`;
  }
  if (password.length < 6) return err(400, "Password must be >= 6 chars");

  const password_hash = await pbkdf2Hash(password);

  try {
    const res = await db
      .prepare(
        `INSERT INTO users (email, password_hash, role, plan, expires_at, is_active)
         VALUES (?, ?, ?, ?, ?, ?)`
      )
      .bind(email, password_hash, role, plan, expires_at, is_active)
      .run();

    const userId = res.meta.last_row_id;
    await db.prepare("INSERT INTO user_settings (user_id) VALUES (?)").bind(userId).run();

    return json({
      ok: true,
      user: { id: userId, email, role, plan, expires_at, is_active },
      temp_password: body.password ? null : password,
    });
  } catch (e) {
    const msg = String(e?.message || e);
    if (msg.toLowerCase().includes("unique")) return err(409, "Email already exists");
    return err(500, "DB error", { detail: msg });
  }
}
