import { json, err, getJsonBody } from "../_lib/http.js";

function cleanText(value, maxLength) {
  return String(value ?? "").replace(/[\r\n\t]+/g, " ").replace(/\s+/g, " ").trim().slice(0, maxLength);
}

function escapeHtml(value) {
  return String(value ?? "").replace(/[&<>"']/g, (char) => ({
    "&": "&amp;",
    "<": "&lt;",
    ">": "&gt;",
    '"': "&quot;",
    "'": "&#39;",
  }[char]));
}

async function notifyOwner(env, request) {
  const recipient = cleanText(env.REGISTRATION_NOTIFY_EMAIL, 160);
  const sender = cleanText(env.NOTIFICATION_FROM_EMAIL, 160);
  if (!env.EMAIL || !recipient || !sender) return false;

  const fields = [
    ["Nombre", request.full_name],
    ["WhatsApp", request.whatsapp],
    ["Correo", request.email || "No indicado"],
    ["Negocio", request.business_name || "No indicado"],
    ["Mensaje", request.message || "No indicado"],
  ];
  const text = fields.map(([label, value]) => `${label}: ${value}`).join("\n");
  const html = `<h1>Nueva solicitud de acceso</h1><ul>${fields
    .map(([label, value]) => `<li><strong>${escapeHtml(label)}:</strong> ${escapeHtml(value)}</li>`)
    .join("")}</ul>`;

  await env.EMAIL.send({
    to: recipient,
    from: { email: sender, name: "CazeExchange" },
    subject: `Nueva solicitud: ${request.full_name}`,
    text,
    html,
  });
  return true;
}

export async function onRequestPost(context) {
  const db = context.env.DB;
  if (!db) return err(500, "Missing D1 binding (env.DB)");

  const body = await getJsonBody(context.request);
  if (!body) return err(400, "Expected JSON");
  // Honeypot: los navegadores reales nunca completan este campo oculto.
  if (cleanText(body.website, 200)) return json({ ok: true }, 201);

  const request = {
    full_name: cleanText(body.full_name, 80),
    whatsapp: cleanText(body.whatsapp, 25),
    email: cleanText(body.email, 120).toLowerCase() || null,
    business_name: cleanText(body.business_name, 100) || null,
    message: cleanText(body.message, 500) || null,
  };

  if (request.full_name.length < 2) return err(400, "Nombre inválido");
  if (!/^[0-9+()\-\s]{7,25}$/.test(request.whatsapp)) return err(400, "WhatsApp inválido");
  if (request.email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(request.email)) {
    return err(400, "Correo inválido");
  }

  const recent = await db
    .prepare(
      `SELECT id FROM registration_requests
       WHERE whatsapp = ? AND created_at >= datetime('now', '-10 minutes')
       ORDER BY created_at DESC LIMIT 1`
    )
    .bind(request.whatsapp)
    .first();
  if (recent) return err(429, "Ya recibimos una solicitud reciente. Te contactaremos pronto.");

  try {
    const result = await db
      .prepare(
        `INSERT INTO registration_requests (full_name, whatsapp, email, business_name, message)
         VALUES (?, ?, ?, ?, ?)`
      )
      .bind(request.full_name, request.whatsapp, request.email, request.business_name, request.message)
      .run();

    let notified = false;
    try {
      notified = await notifyOwner(context.env, request);
      if (notified) {
        await db.prepare("UPDATE registration_requests SET notified_at = datetime('now') WHERE id = ?")
          .bind(result.meta.last_row_id)
          .run();
      }
    } catch (emailError) {
      console.error("REGISTRATION_EMAIL_FAILED", String(emailError?.message || emailError));
    }

    return json({ ok: true, request_id: result.meta.last_row_id, notified }, 201);
  } catch (error) {
    const message = String(error?.message || error);
    if (message.includes("no such table")) {
      return err(503, "El registro se está preparando. Intenta nuevamente en unos minutos.");
    }
    console.error("REGISTRATION_FAILED", message);
    return err(500, "No se pudo guardar la solicitud");
  }
}
