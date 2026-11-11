import { verifyAdmin } from "../../lib/admin-auth.js";

export async function onRequestPost({ request, env }) {
  try {
    if (!env.DB) {
      return Response.json(
        { error: "Database missing" },
        { status: 500 }
      );
    }

    if (!await verifyAdmin(request, env)) {
      return Response.json(
        { error: "Unauthorized" },
        { status: 401 }
      );
    }
    const body = await request.json();
    const token = body.token;

    if (!token || typeof token !== "string" || token.length > 4096) {
      return Response.json(
        { error: "Valid notification token required" },
        { status: 400 }
      );
    }

    await env.DB.prepare(`
      CREATE TABLE IF NOT EXISTS admin_push_tokens (
        token TEXT PRIMARY KEY,
        created_at TEXT DEFAULT CURRENT_TIMESTAMP
      )
    `).run();

    await env.DB.prepare(`
      INSERT OR IGNORE INTO admin_push_tokens (token)
      VALUES (?)
    `).bind(token).run();

    return Response.json({
      success: true,
      message: "Admin notification device registered"
    });

  } catch (error) {
    return Response.json(
      { error: "Token registration failed" },
      { status: 500 }
    );
  }
}
