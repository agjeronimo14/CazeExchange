import { json, err, getJsonBody } from "../../_lib/http.js";
import { requireAdmin } from "../../_lib/auth.js";

const DAY_MS = 24 * 60 * 60 * 1000;

export async function onRequestPost(context) {
  const db = context.env.DB;
  if (!db) return err(500, "Missing D1 binding (env.DB)");

  const { response } = await requireAdmin(context);
  if (response) return response;

  const body = await getJsonBody(context.request);
  if (!body) return err(400, "Expected JSON");

  const userId = Number(body.user_id);
  const days = Number(body.days ?? 30);
  if (!Number.isInteger(userId) || userId <= 0) return err(400, "user_id required");
  if (!Number.isInteger(days) || days < 1 || days > 3650) {
    return err(400, "days must be an integer between 1 and 3650");
  }

  const user = await db
    .prepare("SELECT id, email, plan, expires_at, is_active FROM users WHERE id = ?")
    .bind(userId)
    .first();
  if (!user) return err(404, "User not found");

  const now = Date.now();
  const currentExpiry = user.expires_at ? Date.parse(user.expires_at) : NaN;
  // Si el plan sigue vigente sumamos desde su fecha final; si no, desde ahora.
  const base = Number.isFinite(currentExpiry) && currentExpiry > now ? currentExpiry : now;
  const expiresAt = new Date(base + days * DAY_MS).toISOString();

  const result = await db
    .prepare("UPDATE users SET expires_at = ? WHERE id = ?")
    .bind(expiresAt, userId)
    .run();
  if (!result.success) return err(500, "Renewal failed");

  return json({
    ok: true,
    user: {
      id: user.id,
      email: user.email,
      plan: user.plan,
      is_active: user.is_active,
      expires_at: expiresAt,
    },
    added_days: days,
  });
}
