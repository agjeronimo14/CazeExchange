import { json, err, getJsonBody } from "../../_lib/http.js";
import { requireAdmin } from "../../_lib/auth.js";
import { pbkdf2Hash, randomToken } from "../../_lib/crypto.js";

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

  let password = String(body.password || "");
  if (!password) password = `CE-${randomToken(8)}`;
  if (password.length < 6) return err(400, "Password must be >= 6 chars");

  const password_hash = await pbkdf2Hash(password);

  const { success } = await db
    .prepare("UPDATE users SET password_hash = ? WHERE id = ?")
    .bind(password_hash, user_id)
    .run();

  if (!success) return err(500, "Update failed");

  // kill active sessions
  await db.prepare("DELETE FROM sessions WHERE user_id = ?").bind(user_id).run();

  return json({ ok: true, temp_password: password });
}
