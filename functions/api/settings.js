import { json, err, getJsonBody } from "../_lib/http.js";
import { requireUser } from "../_lib/auth.js";

function toNum(x) {
  const n = Number(String(x ?? "").replace(",", "."));
  return Number.isFinite(n) ? n : null;
}

export async function onRequest(context) {
  const db = context.env.DB;
  if (!db) return err(500, "Missing D1 binding (env.DB)");

  const { user, response } = await requireUser(context);
  if (response) return response;

  if (context.request.method === "GET") {
    const s = await db.prepare("SELECT * FROM user_settings WHERE user_id = ?").bind(user.id).first();
    if (!s) {
      await db.prepare("INSERT INTO user_settings (user_id) VALUES (?)").bind(user.id).run();
      return json({ ok: true, settings: { adj_bcv: 0, adj_parallel: 0, adj_usdt_cop: 0, adj_usdt_ves: 0 } });
    }
    return json({
      ok: true,
      settings: {
        adj_bcv: s.adj_bcv,
        adj_parallel: s.adj_parallel,
        adj_usdt_cop: s.adj_usdt_cop,
        adj_usdt_ves: s.adj_usdt_ves,
        updated_at: s.updated_at,
      },
    });
  }

  if (context.request.method === "PUT") {
    const body = await getJsonBody(context.request);
    if (!body) return err(400, "Expected JSON");

    const adj_bcv = toNum(body.adj_bcv);
    const adj_parallel = toNum(body.adj_parallel);
    const adj_usdt_cop = toNum(body.adj_usdt_cop);
    const adj_usdt_ves = toNum(body.adj_usdt_ves);

    // clamp to sane range to prevent typos
    function clamp(v) {
      if (v == null) return null;
      return Math.max(-50, Math.min(50, v));
    }

    await db
      .prepare(
        `INSERT INTO user_settings (user_id, adj_bcv, adj_parallel, adj_usdt_cop, adj_usdt_ves, updated_at)
         VALUES (?, ?, ?, ?, ?, datetime('now'))
         ON CONFLICT(user_id) DO UPDATE SET
           adj_bcv = excluded.adj_bcv,
           adj_parallel = excluded.adj_parallel,
           adj_usdt_cop = excluded.adj_usdt_cop,
           adj_usdt_ves = excluded.adj_usdt_ves,
           updated_at = datetime('now')`
      )
      .bind(
        user.id,
        clamp(adj_bcv) ?? 0,
        clamp(adj_parallel) ?? 0,
        clamp(adj_usdt_cop) ?? 0,
        clamp(adj_usdt_ves) ?? 0
      )
      .run();

    return json({ ok: true });
  }

  return err(405, "Method not allowed");
}
