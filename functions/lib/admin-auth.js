
const encoder = new TextEncoder();
const ITERATIONS = 150000;

function safeEqual(a, b) {
  if (typeof a !== "string" || typeof b !== "string") return false;

  let difference = a.length ^ b.length;
  const length = Math.max(a.length, b.length);

  for (let i = 0; i < length; i++) {
    difference |= (a.charCodeAt(i) || 0) ^ (b.charCodeAt(i) || 0);
  }

  return difference === 0;
}

function randomSalt() {
  const bytes = new Uint8Array(16);
  crypto.getRandomValues(bytes);

  return Array.from(bytes, byte =>
    byte.toString(16).padStart(2, "0")
  ).join("");
}

async function hashPassword(password, salt) {
  const key = await crypto.subtle.importKey(
    "raw",
    encoder.encode(password),
    "PBKDF2",
    false,
    ["deriveBits"]
  );

  const bits = await crypto.subtle.deriveBits(
    {
      name: "PBKDF2",
      salt: encoder.encode(salt),
      iterations: ITERATIONS,
      hash: "SHA-256"
    },
    key,
    256
  );

  return Array.from(new Uint8Array(bits), byte =>
    byte.toString(16).padStart(2, "0")
  ).join("");
}

async function setupCredentialsTable(db) {
  await db.prepare(`
    CREATE TABLE IF NOT EXISTS admin_credentials (
      id INTEGER PRIMARY KEY CHECK (id = 1),
      password_hash TEXT NOT NULL,
      password_salt TEXT NOT NULL,
      updated_at INTEGER NOT NULL
    )
  `).run();
}

export async function verifyAdmin(request, env) {
  try {
    const email = request.headers.get("X-Admin-Email") || "";
    const password = request.headers.get("X-Admin-Password") || "";

    if (
      !env.DB ||
      !env.ADMIN_EMAIL ||
      !email ||
      !password ||
      !safeEqual(email, env.ADMIN_EMAIL)
    ) {
      return false;
    }

    await setupCredentialsTable(env.DB);

    const saved = await env.DB.prepare(
      "SELECT password_hash, password_salt FROM admin_credentials WHERE id = 1"
    ).first();

    // If a password was already reset, verify the new hashed password.
    if (saved) {
      const submittedHash = await hashPassword(
        password,
        saved.password_salt
      );

      return safeEqual(submittedHash, saved.password_hash);
    }

    // First login: use the existing Cloudflare secret.
    if (
      !env.ADMIN_PASSWORD ||
      !safeEqual(password, env.ADMIN_PASSWORD)
    ) {
      return false;
    }

    // Securely save the existing password as a hash for future logins.
    const salt = randomSalt();
    const passwordHash = await hashPassword(password, salt);

    await env.DB.prepare(`
      INSERT INTO admin_credentials
        (id, password_hash, password_salt, updated_at)
      VALUES (1, ?, ?, ?)
      ON CONFLICT(id) DO NOTHING
    `).bind(passwordHash, salt, Date.now()).run();

    // Re-read in case another login or reset happened at the same time.
    const current = await env.DB.prepare(
      "SELECT password_hash, password_salt FROM admin_credentials WHERE id = 1"
    ).first();

    if (!current) return false;

    const finalHash = await hashPassword(
      password,
      current.password_salt
    );

    return safeEqual(finalHash, current.password_hash);

  } catch (error) {
    console.error("Admin authentication error:", error);
    return false;
  }
}
