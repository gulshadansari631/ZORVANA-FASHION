
const ACCESS_TABLE_SQL = `
  CREATE TABLE IF NOT EXISTS admin_access (
    uid TEXT PRIMARY KEY,
    email TEXT NOT NULL,
    status TEXT NOT NULL DEFAULT 'pending',
    created_at INTEGER NOT NULL,
    updated_at INTEGER NOT NULL
  )
`;

export async function ensureAdminAccessTable(db) {
  await db.prepare(ACCESS_TABLE_SQL).run();
}

export function isOwner(email, env) {
  return Boolean(
    email &&
    env.ADMIN_EMAIL &&
    email.trim().toLowerCase() === env.ADMIN_EMAIL.trim().toLowerCase()
  );
}

export async function verifyFirebaseUser(request, env) {
  try {
    const authorization = request.headers.get("Authorization") || "";
    const match = authorization.match(/^Bearer\s+(.+)$/i);
    const idToken = match?.[1];

    if (!idToken || !env.FIREBASE_API_KEY) return null;

    const response = await fetch(
      `https://identitytoolkit.googleapis.com/v1/accounts:lookup?key=${env.FIREBASE_API_KEY}`,
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ idToken })
      }
    );

    if (!response.ok) return null;

    const data = await response.json();
    const user = data.users?.[0];

    if (!user || user.emailVerified !== true) return null;

    return {
      uid: user.localId,
      email: (user.email || "").trim().toLowerCase(),
      emailVerified: true
    };
  } catch (error) {
    console.error("FIREBASE_AUTH_ERROR", error);
    return null;
  }
}

export async function verifyAdmin(request, env) {
  try {
    if (!env.DB) return false;

    const user = await verifyFirebaseUser(request, env);
    if (!user) return false;

    if (isOwner(user.email, env)) return true;

    await ensureAdminAccessTable(env.DB);

    const approved = await env.DB.prepare(`
      SELECT uid FROM admin_access
      WHERE uid = ?
        AND email = ?
        AND status = 'approved'
      LIMIT 1
    `).bind(user.uid, user.email).first();

    return Boolean(approved);
  } catch (error) {
    console.error("ADMIN_ACCESS_ERROR", error);
    return false;
  }
}
