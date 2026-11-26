import {
  verifyFirebaseUser,
  isOwner,
  ensureAdminAccessTable
} from "../../../lib/admin-auth.js";

function json(data, status = 200) {
  return Response.json(data, {
    status,
    headers: { "Cache-Control": "no-store" }
  });
}

export async function onRequest({ request, env }) {
  if (!env.DB) {
    return json({ success: false, error: "Database missing" }, 500);
  }

  const user = await verifyFirebaseUser(request, env);

  if (!user) {
    return json({
      success: false,
      error: "Please sign in with your verified email."
    }, 401);
  }

  try {
    await ensureAdminAccessTable(env.DB);

    if (request.method === "GET") {
      if (!isOwner(user.email, env)) {
        return json({ success: false, error: "Owner access required." }, 403);
      }

      const result = await env.DB.prepare(`
        SELECT uid, email, status, created_at, updated_at
        FROM admin_access
        ORDER BY created_at DESC
      `).all();

      return json({ success: true, users: result.results || [] });
    }

    if (request.method !== "POST") {
      return json({ success: false, error: "Method not allowed" }, 405);
    }

    const body = await request.json().catch(() => ({}));


    if (body.action === "request") {
      if (!isOwner(user.email, env)) {
        return json({
          success: false,
          status: "denied",
          message: "Sirf owner Gmail ko Admin access hai."
        }, 403);
      }

      return json({
        success: true,
        status: "approved",
        owner: true
      });
    }

    if (body.action === "decision") {
      if (!isOwner(user.email, env)) {
        return json({ success: false, error: "Owner access required." }, 403);
      }

      const uid = String(body.uid || "").trim();
      const status = String(body.status || "").trim();

      if (!uid || !["approved", "rejected", "revoked"].includes(status)) {
        return json({ success: false, error: "Invalid user or status." }, 400);
      }

      const result = await env.DB.prepare(`
        UPDATE admin_access
        SET status = ?, updated_at = ?
        WHERE uid = ?
      `).bind(status, Date.now(), uid).run();

      if (!result.meta.changes) {
        return json({ success: false, error: "User request not found." }, 404);
      }

      return json({ success: true, message: "User access updated.", status });
    }

    return json({ success: false, error: "Invalid action." }, 400);
  } catch (error) {
    console.error("ADMIN_ACCESS_ERROR", error);
    return json({ success: false, error: "Access operation failed." }, 500);
  }
}
