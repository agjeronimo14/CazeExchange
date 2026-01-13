const te = new TextEncoder();

function randomBytes(n) {
  const a = new Uint8Array(n);
  crypto.getRandomValues(a);
  return a;
}

// Base64 (no-url) para guardar en DB
function b64(bytes) {
  return Buffer.from(bytes).toString("base64");
}
function b64ToBytes(s) {
  return new Uint8Array(Buffer.from(s, "base64"));
}

// Token para sesiones / reset passwords (base64url)
export function randomToken(size = 32) {
  return Buffer.from(randomBytes(size)).toString("base64url");
}

// === Compat: pbkdf2Hash / pbkdf2Verify (lo que esperan tus imports) ===
export async function pbkdf2Hash(password, iterations = 100000) {
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

  // Formato: pbkdf2$sha256$iter$saltB64$hashB64
  return `pbkdf2$sha256$${iterations}$${b64(salt)}$${b64(hash)}`;
}

export async function pbkdf2Verify(password, stored) {
  try {
    const [algo, hashName, iterStr, saltB64, hashB64] = String(stored).split("$");
    if (algo !== "pbkdf2" || hashName !== "sha256") return false;

    const iterations = Number(iterStr);
    if (!Number.isFinite(iterations) || iterations <= 0) return false;

    const salt = b64ToBytes(saltB64);
    const expected = b64ToBytes(hashB64);

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

// === Aliases opcionales (por si en otros lados usas hashPassword/verifyPassword) ===
export const hashPassword = pbkdf2Hash;
export const verifyPassword = pbkdf2Verify;

// Para sesiones si alguna parte lo usa con otro nombre
export function generateSessionId() {
  return randomToken(32);
}
