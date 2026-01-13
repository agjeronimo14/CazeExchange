import { err, json, getJsonBody } from "../../_lib/http.js";
import { requireAdmin } from "../../_lib/auth.js";

export async function onRequest(context) {
  if (context.request.method !== "POST") return err(405, "Method not allowed");

  const db = context.env.DB;
  if (!db) return err(500, "Missing D1 binding (env.DB)");

  const { user: adminUser, response } = await requireAdmin(context);
  if (response) return response;

  const body = await getJsonBody(context.request);
  if (!body) return err(400, "Expected JSON");

  const user_id = Number(body.user_id);
  if (!Number.isFinite(user_id)) return err(400, "user_id required");

  // no te dejes borrar a ti mismo
  if (user_id === adminUser.id) return err(400, "You cannot delete your own admin user");

  // Bloqueo extra: no borrar admins (opcional pero recomendado)
  const target = await db.prepare("SELECT id, role, email FROM users WHERE id = ?").bind(user_id).first();
  if (!target) return err(404, "User not found");
  if (target.role === "admin") return err(403, "Cannot delete an admin user");

  const r = await db.prepare("DELETE FROM users WHERE id = ?").bind(user_id).run();
  if (!r.success) return err(500, "Delete failed");

  return json({ ok: true, deleted_id: user_id });
}
