import { json, err, getJsonBody } from "../_lib/http.js";
import { requireUser } from "../_lib/auth.js";
import { DEFAULT_BRANDING, normalizeBranding, parseBrandJson } from "../_lib/branding.js";

async function ensureSettingsRow(db, userId) {
  const s = await db.prepare("SELECT user_id FROM user_settings WHERE user_id = ?").bind(userId).first();
  if (s) return;
  await db.prepare("INSERT INTO user_settings (user_id, updated_at) VALUES (?, datetime('now'))").bind(userId).run();
}

async function selectBranding(db, userId) {
  // Si la migración aún no se aplicó, esta consulta puede fallar.
  try {
    const row = await db.prepare("SELECT brand_json FROM user_settings WHERE user_id = ?").bind(userId).first();
    return parseBrandJson(row?.brand_json) || { ...DEFAULT_BRANDING };
  } catch {
    return { ...DEFAULT_BRANDING };
  }
}

export async function onRequest(context) {
  const db = context.env.DB;
  if (!db) return err(500, "Missing D1 binding (env.DB)");

  const { user, response } = await requireUser(context);
  if (response) return response;

  if (context.request.method === "GET") {
    await ensureSettingsRow(db, user.id);
    const branding = await selectBranding(db, user.id);
    return json({ ok: true, branding });
  }

  if (context.request.method === "POST") {
    const body = await getJsonBody(context.request);
    if (!body) return err(400, "Expected JSON");

    const branding = normalizeBranding(body.branding ?? body);
    await ensureSettingsRow(db, user.id);

    try {
      await db.prepare(
        `INSERT INTO user_settings (user_id, brand_json, updated_at)
         VALUES (?, ?, datetime('now'))
         ON CONFLICT(user_id) DO UPDATE SET
           brand_json = excluded.brand_json,
           updated_at = datetime('now')`
      ).bind(user.id, JSON.stringify(branding)).run();
    } catch (e) {
      // Si falta la columna, avisamos claro.
      return err(500, "Branding not ready (apply D1 migration)", { message: String(e?.message || e) });
    }

    return json({ ok: true, branding });
  }

  return err(405, "Method not allowed");
}
