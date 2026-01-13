const te = new TextEncoder();

function b64(bytes) {
  return Buffer.from(bytes).toString("base64");
}
function b64ToBytes(s) {
  return new Uint8Array(Buffer.from(s, "base64"));
}
function randomBytes(n) {
  const a = new Uint8Array(n);
  crypto.getRandomValues(a);
  return a;
}

export async function hashPassword(password, iterations = 120000) {
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

export async function verifyPassword(password, stored) {
  try {
    const [algo, hashName, iterStr, saltB64, hashB64] = stored.split("$");
    if (algo !== "pbkdf2" || hashName !== "sha256") return false;

    const iterations = Number(iterStr);
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

export function generateSessionId() {
  // token base64url
  const bytes = randomBytes(32);
  return Buffer.from(bytes).toString("base64url");
}
