import { err } from "./http.js";
import { randomToken } from "./crypto.js";
import { isHttps } from "./http.js";

const COOKIE_NAME = "ce_session";

function parseCookies(cookieHeader = "") {
  const out = {};
  cookieHeader.split(";").forEach((part) => {
    const i = part.indexOf("=");
    if (i === -1) return;
    const k = part.slice(0, i).trim();
    const v = part.slice(i + 1).trim();
    if (k) out[k] = decodeURIComponent(v);
  });
  return out;
}

function cookieSerialize(name, value, opts = {}) {
  const parts = [`${name}=${encodeURIComponent(value)}`];
  if (opts.maxAge != null) parts.push(`Max-Age=${opts.maxAge}`);
  if (opts.expires) parts.push(`Expires=${opts.expires.toUTCString()}`);
  parts.push(`Path=${opts.path || "/"}`);
  if (opts.httpOnly !== false) parts.push("HttpOnly");
  parts.push(`SameSite=${opts.sameSite || "Lax"}`);
  if (opts.secure) parts.push("Secure");
  return parts.join("; ");
}

export async function getUserFromSession(context) {
  const db = context.env.DB;
  if (!db) throw new Error("Missing D1 binding: env.DB");

  const cookies = parseCookies(context.request.headers.get("Cookie") || "");
  const sid = cookies[COOKIE_NAME];
  if (!sid) return null;

  // Load session (and user) in one query.
  const nowIso = new Date().toISOString();
  const row = await db
    .prepare(
      `SELECT s.id as session_id, s.expires_at as session_expires_at,
              u.id as user_id, u.email, u.role, u.plan, u.expires_at, u.is_active
       FROM sessions s
       JOIN users u ON u.id = s.user_id
       WHERE s.id = ?`
    )
    .bind(sid)
    .first();

  if (!row) return null;

  // Session expiry
  if (row.session_expires_at <= nowIso) {
    await db.prepare("DELETE FROM sessions WHERE id = ?").bind(sid).run();
    return null;
  }

  // User active + plan expiry
  if (Number(row.is_active) !== 1) return null;
  if (row.expires_at && row.expires_at <= nowIso) return null;

  return {
    id: row.user_id,
    email: row.email,
    role: row.role,
    plan: row.plan,
    expires_at: row.expires_at,
  };
}

export async function requireUser(context) {
  const user = await getUserFromSession(context);
  if (!user) return { user: null, response: err(401, "Not authenticated") };
  return { user, response: null };
}

export async function requireAdmin(context) {
  const { user, response } = await requireUser(context);
  if (response) return { user: null, response };
  if (user.role !== "admin") return { user: null, response: err(403, "Admin only") };
  return { user, response: null };
}

export async function createSession(context, userId, { days = 30 } = {}) {
  const db = context.env.DB;
  const sid = randomToken(32);
  const expires = new Date(Date.now() + days * 86400_000);
  await db
    .prepare("INSERT INTO sessions (id, user_id, expires_at) VALUES (?, ?, ?)")
    .bind(sid, userId, expires.toISOString())
    .run();
  return { sid, expires };
}

export async function destroySession(context) {
  const db = context.env.DB;
  const cookies = parseCookies(context.request.headers.get("Cookie") || "");
  const sid = cookies[COOKIE_NAME];
  if (sid) {
    await db.prepare("DELETE FROM sessions WHERE id = ?").bind(sid).run();
  }
  return sid;
}

export function setSessionCookie(context, sid, expires) {
  const secure = isHttps(context.request);
  const header = cookieSerialize(COOKIE_NAME, sid, {
    secure,
    httpOnly: true,
    sameSite: "Lax",
    path: "/",
    expires,
  });
  return header;
}

export function clearSessionCookie(context) {
  const secure = isHttps(context.request);
  const header = cookieSerialize(COOKIE_NAME, "deleted", {
    secure,
    httpOnly: true,
    sameSite: "Lax",
    path: "/",
    expires: new Date(0),
  });
  return header;
}
