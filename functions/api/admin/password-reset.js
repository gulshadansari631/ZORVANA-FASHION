
const ADMIN_EMAIL = "gulshadansari631@gmail.com";
const SENDER_EMAIL = "gulshadansari631@gmail.com";
const SENDER_NAME = "ZORVANA FASHION";

const encoder = new TextEncoder();

function json(data, status = 200) {
  return Response.json(data, {
    status,
    headers: { "Cache-Control": "no-store" }
  });
}

function randomHex(length = 16) {
  const bytes = new Uint8Array(length);
  crypto.getRandomValues(bytes);
  return Array.from(bytes, b =>
    b.toString(16).padStart(2, "0")
  ).join("");
}

function randomOTP() {
  const bytes = new Uint32Array(1);
  crypto.getRandomValues(bytes);
  return String(100000 + (bytes[0] % 900000));
}

async function hashValue(value, salt) {
  const key = await crypto.subtle.importKey(
    "raw",
    encoder.encode(value),
    "PBKDF2",
    false,
    ["deriveBits"]
  );

  const bits = await crypto.subtle.deriveBits({
    name: "PBKDF2",
    salt: encoder.encode(salt),
    iterations: 150000,
    hash: "SHA-256"
  }, key, 256);

  return Array.from(new Uint8Array(bits), b =>
    b.toString(16).padStart(2, "0")
  ).join("");
}

async function setupDB(db) {
  await db.batch([
    db.prepare(`
      CREATE TABLE IF NOT EXISTS admin_password_reset (
        id INTEGER PRIMARY KEY CHECK (id = 1),
        otp_hash TEXT NOT NULL,
        otp_salt TEXT NOT NULL,
        expires_at INTEGER NOT NULL,
        attempts INTEGER NOT NULL DEFAULT 0,
        last_sent INTEGER NOT NULL
      )
    `),
    db.prepare(`
      CREATE TABLE IF NOT EXISTS admin_credentials (
        id INTEGER PRIMARY KEY CHECK (id = 1),
        password_hash TEXT NOT NULL,
        password_salt TEXT NOT NULL,
        updated_at INTEGER NOT NULL
      )
    `)
  ]);
}

async function sendOTP(env) {
  const now = Date.now();

  const previous = await env.DB.prepare(
    "SELECT last_sent FROM admin_password_reset WHERE id = 1"
  ).first();

  if (previous && now - Number(previous.last_sent) < 60000) {
    return json({
      error: "Please wait 60 seconds before requesting another OTP."
    }, 429);
  }

  const otp = randomOTP();
  const salt = randomHex(16);
  const otpHash = await hashValue(otp, salt);

  await env.DB.prepare(`
    INSERT INTO admin_password_reset
      (id, otp_hash, otp_salt, expires_at, attempts, last_sent)
    VALUES (1, ?, ?, ?, 0, ?)
    ON CONFLICT(id) DO UPDATE SET
      otp_hash = excluded.otp_hash,
      otp_salt = excluded.otp_salt,
      expires_at = excluded.expires_at,
      attempts = 0,
      last_sent = excluded.last_sent
  `).bind(
    otpHash,
    salt,
    now + 5 * 60 * 1000,
    now
  ).run();

  try {
    const response = await fetch(
      "https://api.brevo.com/v3/smtp/email",
      {
        method: "POST",
        headers: {
          "api-key": env.BREVO_API_KEY,
          "Content-Type": "application/json",
          "accept": "application/json"
        },
        body: JSON.stringify({
          sender: {
            name: SENDER_NAME,
            email: SENDER_EMAIL
          },
          to: [{ email: ADMIN_EMAIL }],
          subject: "ZORVANA FASHION Admin Password Reset OTP",
          textContent:
            `Your ZORVANA FASHION password reset OTP is ${otp}. ` +
            "It expires in 5 minutes. Do not share this code with anyone."
        })
      }
    );

    if (!response.ok) {
      console.error("Brevo email error:", await response.text());

      await env.DB.prepare(
        "DELETE FROM admin_password_reset WHERE id = 1"
      ).run();

      return json({
        error: "Email could not be sent. Please try again."
      }, 502);
    }
  } catch (error) {
    await env.DB.prepare(
      "DELETE FROM admin_password_reset WHERE id = 1"
    ).run();

    throw error;
  }

  return json({
    success: true,
    message: "OTP sent to your registered email."
  });
}

async function resetPassword(env, body) {
  const otp = String(body.otp || "").trim();
  const newPassword = String(body.newPassword || "");

  if (!/^[0-9]{6}$/.test(otp)) {
    return json({
      error: "Enter a valid 6-digit OTP."
    }, 400);
  }

  if (newPassword.length < 10 || newPassword.length > 128) {
    return json({
      error: "Password must be 10 to 128 characters long."
    }, 400);
  }

  const record = await env.DB.prepare(
    "SELECT * FROM admin_password_reset WHERE id = 1"
  ).first();

  if (!record || Date.now() > Number(record.expires_at)) {
    return json({
      error: "OTP expired. Request a new OTP."
    }, 400);
  }

  if (Number(record.attempts) >= 5) {
    return json({
      error: "Too many attempts. Request a new OTP."
    }, 429);
  }

  const submittedHash = await hashValue(
    otp,
    record.otp_salt
  );

  if (submittedHash !== record.otp_hash) {
    await env.DB.prepare(`
      UPDATE admin_password_reset
      SET attempts = attempts + 1
      WHERE id = 1
    `).run();

    return json({
      error: "Incorrect OTP."
    }, 400);
  }

  const salt = randomHex(16);
  const passwordHash = await hashValue(newPassword, salt);
  const now = Date.now();

  await env.DB.batch([
    env.DB.prepare(`
      INSERT INTO admin_credentials
        (id, password_hash, password_salt, updated_at)
      VALUES (1, ?, ?, ?)
      ON CONFLICT(id) DO UPDATE SET
        password_hash = excluded.password_hash,
        password_salt = excluded.password_salt,
        updated_at = excluded.updated_at
    `).bind(passwordHash, salt, now),

    env.DB.prepare(
      "DELETE FROM admin_password_reset WHERE id = 1"
    )
  ]);

  return json({
    success: true,
    message: "Password reset successfully. Please login with your new password."
  });
}

export async function onRequestPost({ request, env }) {
  try {
    if (!env.DB || !env.BREVO_API_KEY) {
      return json({
        error: "Server configuration is incomplete."
      }, 500);
    }

    await setupDB(env.DB);

    let body;

    try {
      body = await request.json();
    } catch {
      return json({
        error: "Invalid request."
      }, 400);
    }

    if (body.action === "send") {
      return await sendOTP(env);
    }

    if (body.action === "reset") {
      return await resetPassword(env, body);
    }

    return json({
      error: "Invalid action."
    }, 400);

  } catch (error) {
    console.error("Password reset error:", error);

    return json({
      error: "Something went wrong. Please try again."
    }, 500);
  }
}
