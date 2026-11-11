
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

export async function checkAdminCredentials(request, env) {
  try {
    const email = (request.headers.get("X-Admin-Email") || "")
      .trim().toLowerCase();

    const password = request.headers.get("X-Admin-Password") || "";

    const configuredEmail = (env.ADMIN_EMAIL || "")
      .trim().toLowerCase();

    if (!env.DB) {
      return { ok: false, code: "DB_BINDING_MISSING",
        message: "Cloudflare DB binding missing." };
    }

    if (!configuredEmail) {
      return { ok: false, code: "ADMIN_EMAIL_MISSING",
        message: "ADMIN_EMAIL Production variable missing." };
    }

    if (!env.ADMIN_PASSWORD) {
      return { ok: false, code: "ADMIN_PASSWORD_MISSING",
        message: "ADMIN_PASSWORD Production secret missing." };
    }

    if (!email || !password) {
      return { ok: false, code: "FIELDS_MISSING",
        message: "Email aur password enter karein." };
    }

    if (!safeEqual(email, configuredEmail)) {
      return { ok: false, code: "EMAIL_MISMATCH",
        message: "Admin email Cloudflare ADMIN_EMAIL se match nahi karta." };
    }

    await setupCredentialsTable(env.DB);

    const saved = await env.DB.prepare(
      "SELECT password_hash, password_salt FROM admin_credentials WHERE id = 1"
    ).first();

    if (saved) {
      const submittedHash = await hashPassword(
        password,
        saved.password_salt
      );

      if (!safeEqual(submittedHash, saved.password_hash)) {
        return {
          ok: false,
          code: "SAVED_PASSWORD_MISMATCH",
          message: "Database mein saved password alag hai. Cloudflare secret badalne se saved password automatic update nahi hota."
        };
      }

      return { ok: true };
    }

    if (!safeEqual(password, env.ADMIN_PASSWORD)) {
      return { ok: false, code: "SECRET_PASSWORD_MISMATCH",
        message: "Entered password Cloudflare ADMIN_PASSWORD secret se match nahi karta." };
    }

    const salt = randomSalt();
    const passwordHash = await hashPassword(password, salt);

    await env.DB.prepare(`
      INSERT INTO admin_credentials
        (id, password_hash, password_salt, updated_at)
      VALUES (1, ?, ?, ?)
      ON CONFLICT(id) DO NOTHING
    `).bind(passwordHash, salt, Date.now()).run();

    const current = await env.DB.prepare(
      "SELECT password_hash, password_salt FROM admin_credentials WHERE id = 1"
    ).first();

    if (!current) {
      return { ok: false, code: "CREDENTIAL_SAVE_FAILED",
        message: "Password verify hua, lekin database mein save nahi ho saka." };
    }

    const finalHash = await hashPassword(password, current.password_salt);

    if (!safeEqual(finalHash, current.password_hash)) {
      return { ok: false, code: "CREDENTIAL_MISMATCH",
        message: "Database password verification fail hui." };
    }

    return { ok: true };

  } catch (error) {
    console.error("Admin authentication error:", error);

    return {
      ok: false,
      code: "AUTH_SERVER_ERROR",
      message: "Admin authentication server error. Cloudflare Functions logs check karein."
    };
  }
}

export async function verifyAdmin(request, env) {
  const result = await checkAdminCredentials(request, env);
  return result.ok === true;
}
