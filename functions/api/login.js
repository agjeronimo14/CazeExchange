import { json, err, getJsonBody } from "../_lib/http.js";
import { pbkdf2Verify } from "../_lib/crypto.js";
import { createSession, setSessionCookie } from "../_lib/auth.js";

export async function onRequest(context) {
  if (context.request.method !== "POST") return err(405, "Method not allowed");

  const body = await getJsonBody(context.request);
  if (!body) return err(400, "Expected JSON");
  const email = String(body.email || "").trim().toLowerCase();
  const password = String(body.password || "");

  if (!email || !password) return err(400, "Email and password are required");

  const db = context.env.DB;
  if (!db) return err(500, "Missing D1 binding (env.DB)");

  const nowIso = new Date().toISOString();
  const user = await db
    .prepare(
      "SELECT id, email, password_hash, role, plan, expires_at, is_active FROM users WHERE email = ?"
    )
    .bind(email)
    .first();

  if (!user) return err(401, "Invalid credentials");
  if (Number(user.is_active) !== 1) return err(403, "User disabled");
  if (user.expires_at && user.expires_at <= nowIso) return err(403, "Plan expired");

  const ok = await pbkdf2Verify(password, user.password_hash);
  if (!ok) return err(401, "Invalid credentials");

  const { sid, expires } = await createSession(context, user.id, { days: 30 });
  const headers = new Headers();
  headers.append("Set-Cookie", setSessionCookie(context, sid, expires));

  return json(
    {
      ok: true,
      user: {
        id: user.id,
        email: user.email,
        role: user.role,
        plan: user.plan,
        expires_at: user.expires_at,
      },
    },
    { headers }
  );
}
