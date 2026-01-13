import { json, err } from "../../_lib/http.js";
import { requireAdmin } from "../../_lib/auth.js";

export async function onRequest(context) {
  if (context.request.method !== "GET") return err(405, "Method not allowed");

  const db = context.env.DB;
  if (!db) return err(500, "Missing D1 binding (env.DB)");

  const { response } = await requireAdmin(context);
  if (response) return response;

  const { results } = await db
    .prepare(
      "SELECT id, email, role, plan, expires_at, is_active, created_at FROM users ORDER BY created_at DESC LIMIT 200"
    )
    .all();

  return json({ ok: true, users: results });
}
