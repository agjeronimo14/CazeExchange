import { json } from "../_lib/http.js";
import { destroySession, clearSessionCookie } from "../_lib/auth.js";

export async function onRequest(context) {
  if (context.request.method !== "POST") return json({ error: "Method not allowed" }, { status: 405 });

  await destroySession(context);

  const headers = new Headers();
  headers.append("Set-Cookie", clearSessionCookie(context));
  return json({ ok: true }, { headers });
}
