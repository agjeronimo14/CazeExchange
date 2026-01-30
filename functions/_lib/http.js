export function json(data, status = 200, extraHeaders = {}) {
  return new Response(JSON.stringify(data), {
    status,
    headers: {
      "content-type": "application/json; charset=utf-8",
      ...extraHeaders,
    },
  });
}

export function err(status = 400, message = "Error", extra = null) {
  const body = { error: message };
  if (extra && typeof extra === "object") {
    for (const [k, v] of Object.entries(extra)) body[k] = v;
  }
  return json(body, status);
}

export async function getJsonBody(request) {
  try {
    return await request.json();
  } catch {
    return null;
  }
}

export function isHttps(request) {
  const proto = request.headers.get("x-forwarded-proto") || "";
  return proto.toLowerCase().includes("https") || request.url.startsWith("https:");
}
