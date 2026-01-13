const te = new TextEncoder();

function randomBytes(n) {
  const a = new Uint8Array(n);
  crypto.getRandomValues(a);
  return a;
}

function bytesToBase64(bytes) {
  let s = "";
  for (let i = 0; i < bytes.length; i++) s += String.fromCharCode(bytes[i]);
  return btoa(s);
}

function base64ToBytes(b64) {
  const bin = atob(b64);
  const out = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) out[i] = bin.charCodeAt(i);
  return out;
}

function bytesToBase64Url(bytes) {
  return bytesToBase64(bytes).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/g, "");
}

export function randomToken(size = 32) {
  return bytesToBase64Url(randomBytes(size));
}

export async function pbkdf2Hash(password, iterations = 100000) {
  // Cloudflare WebCrypto limita a 100000
  if (iterations > 100000) iterations = 100000;

  const salt = randomBytes(16);

  const key = await crypto.subtle.importKey(
    "raw",
    te.encode(password),
    { name: "PBKDF2" },
    false,
    ["deriveBits"]
  );

  const bits = await crypto.subtle.deriveBits(
    { name: "PBKDF2", salt, iterations, hash: "SHA-256" },
    key,
    256
  );

  const hash = new Uint8Array(bits);
  return `pbkdf2$sha256$${iterations}$${bytesToBase64(salt)}$${bytesToBase64(hash)}`;
}

export async function pbkdf2Verify(password, stored) {
  try {
    const [algo, hashName, iterStr, saltB64, hashB64] = String(stored).split("$");
    if (algo !== "pbkdf2" || hashName !== "sha256") return false;

    let iterations = Number(iterStr);
    if (!Number.isFinite(iterations) || iterations <= 0) return false;
    if (iterations > 100000) iterations = 100000;

    const salt = base64ToBytes(saltB64);
    const expected = base64ToBytes(hashB64);

    const key = await crypto.subtle.importKey(
      "raw",
      te.encode(password),
      { name: "PBKDF2" },
      false,
      ["deriveBits"]
    );

    const bits = await crypto.subtle.deriveBits(
      { name: "PBKDF2", salt, iterations, hash: "SHA-256" },
      key,
      256
    );

    const got = new Uint8Array(bits);
    if (got.length !== expected.length) return false;

    let diff = 0;
    for (let i = 0; i < got.length; i++) diff |= got[i] ^ expected[i];
    return diff === 0;
  } catch {
    return false;
  }
}

// Aliases por si los usas en otros lugares
export const hashPassword = pbkdf2Hash;
export const verifyPassword = pbkdf2Verify;
export function generateSessionId() {
  return randomToken(32);
}
