export function json(data, init = {}) {
  const headers = new Headers(init.headers || {});
  if (!headers.has("content-type")) headers.set("content-type", "application/json; charset=utf-8");
  // Default: no-store for auth/admin responses. Rates endpoint can override.
  if (!headers.has("cache-control")) headers.set("cache-control", "no-store");
  return new Response(JSON.stringify(data), { ...init, headers });
}

export function text(data, init = {}) {
  const headers = new Headers(init.headers || {});
  if (!headers.has("content-type")) headers.set("content-type", "text/plain; charset=utf-8");
  if (!headers.has("cache-control")) headers.set("cache-control", "no-store");
  return new Response(data, { ...init, headers });
}

export function err(status, message, extra = {}) {
  return json({ error: message, ...extra }, { status });
}

export function getJsonBody(request) {
  const ct = request.headers.get("content-type") || "";
  if (!ct.includes("application/json")) return null;
  return request.json();
}

export function isHttps(request) {
  return new URL(request.url).protocol === "https:";
}
