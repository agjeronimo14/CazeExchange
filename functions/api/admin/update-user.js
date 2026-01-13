import { json, err, getJsonBody } from "../../_lib/http.js";
import { requireAdmin } from "../../_lib/auth.js";

function normalizeRole(role) {
  const r = String(role || "").toLowerCase();
  if (["admin", "pro", "trial", "viewer"].includes(r)) return r;
  return null;
}

export async function onRequest(context) {
  if (context.request.method !== "POST") return err(405, "Method not allowed");

  const db = context.env.DB;
  if (!db) return err(500, "Missing D1 binding (env.DB)");

  const { response } = await requireAdmin(context);
  if (response) return response;

  const body = await getJsonBody(context.request);
  if (!body) return err(400, "Expected JSON");

  const user_id = Number(body.user_id);
  if (!Number.isFinite(user_id)) return err(400, "user_id required");

  const role = body.role != null ? normalizeRole(body.role) : null;
  const plan = body.plan != null ? String(body.plan) : null;
  const expires_at = body.expires_at === "" ? null : (body.expires_at != null ? String(body.expires_at) : null);
  const is_active = body.is_active != null ? (body.is_active ? 1 : 0) : null;

  const sets = [];
  const binds = [];
  if (role) { sets.push("role = ?"); binds.push(role); }
  if (plan != null) { sets.push("plan = ?"); binds.push(plan); }
  if (body.expires_at !== undefined) { sets.push("expires_at = ?"); binds.push(expires_at); }
  if (is_active != null) { sets.push("is_active = ?"); binds.push(is_active); }

  if (!sets.length) return err(400, "No fields to update");

  binds.push(user_id);

  await db.prepare(`UPDATE users SET ${sets.join(", ")} WHERE id = ?`).bind(...binds).run();

  // If disabled, kill sessions
  if (is_active === 0) await db.prepare("DELETE FROM sessions WHERE user_id = ?").bind(user_id).run();

  return json({ ok: true });
}
