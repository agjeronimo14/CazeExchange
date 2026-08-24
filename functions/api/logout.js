import { json } from "../_lib/http.js";
import { destroySession, clearSessionCookie } from "../_lib/auth.js";

export async function onRequest(context) {
  if (context.request.method !== "POST") return json({ error: "Method not allowed" }, 405);

  await destroySession(context);

  return json({ ok: true }, 200, {
    "Set-Cookie": clearSessionCookie(context),
  });
}
