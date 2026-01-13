import { pbkdf2Verify } from "../_lib/crypto.js";
import { json, buildSetCookie, makeSessionId } from "../_lib/auth.js";

export async function onRequestPost({ request, env }) {
  try {
    let body;
    try {
      body = await request.json();
    } catch {
      return json({ error: "Expected JSON" }, 400);
    }

    const email = String(body.email || "").trim().toLowerCase();
    const password = String(body.password || "");
    if (!email || !password) return json({ error: "Missing email/password" }, 400);
    if (!env.DB) return json({ error: "Missing D1 binding env.DB" }, 500);

    const user = await env.DB.prepare(
      "SELECT id,email,password_hash,role,plan,expires_at,is_active FROM users WHERE email = ?"
    ).bind(email).first();

    if (!user) return json({ error: "Invalid credentials" }, 401);
    if (Number(user.is_active) !== 1) return json({ error: "User inactive" }, 403);

    // expiración (si aplica)
    if (user.expires_at) {
      const exp = new Date(user.expires_at).getTime();
      if (Number.isFinite(exp) && Date.now() > exp) {
        return json({ error: "Plan expired" }, 403);
      }
    }

    const ok = await pbkdf2Verify(password, user.password_hash);
    if (!ok) return json({ error: "Invalid credentials" }, 401);

    // crear sesión
    const sid = makeSessionId();
    const expiresAt = new Date(Date.now() + 1000 * 60 * 60 * 24 * 14).toISOString(); // 14 días

    await env.DB.prepare(
      "INSERT INTO sessions (id, user_id, expires_at) VALUES (?, ?, ?)"
    ).bind(sid, user.id, expiresAt).run();

    const setCookie = buildSetCookie("ce_session", sid, {
      httpOnly: true,
      secure: true,
      sameSite: "Lax",
      path: "/",
      maxAge: 60 * 60 * 24 * 14,
    });

    return json(
      { ok: true, user: { id: user.id, email: user.email, role: user.role, plan: user.plan } },
      200,
      { "set-cookie": setCookie }
    );
  } catch (e) {
    console.error("LOGIN_CRASH:", e);
    return new Response(JSON.stringify({
      error: "Login crashed",
      message: String(e?.message || e),
      stack: String(e?.stack || "")
    }), { status: 500, headers: { "content-type": "application/json; charset=utf-8" } });
  }
}
