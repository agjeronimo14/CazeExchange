import { json, err } from "../_lib/http.js";
import { requireUser } from "../_lib/auth.js";

async function ensureSettings(db, userId) {
  const s = await db.prepare("SELECT * FROM user_settings WHERE user_id = ?").bind(userId).first();
  if (s) return s;
  await db.prepare("INSERT INTO user_settings (user_id) VALUES (?)").bind(userId).run();
  return await db.prepare("SELECT * FROM user_settings WHERE user_id = ?").bind(userId).first();
}

export async function onRequest(context) {
  if (context.request.method !== "GET") return err(405, "Method not allowed");

  const db = context.env.DB;
  if (!db) return err(500, "Missing D1 binding (env.DB)");

  const { user, response } = await requireUser(context);
  if (response) return response;

  const settings = await ensureSettings(db, user.id);

  return json({
    ok: true,
    user,
    settings: {
      adj_bcv: settings.adj_bcv,
      adj_parallel: settings.adj_parallel,
      adj_usdt_cop: settings.adj_usdt_cop,
      adj_usdt_ves: settings.adj_usdt_ves,
      updated_at: settings.updated_at,
    },
    now: new Date().toISOString(),
  });
}
