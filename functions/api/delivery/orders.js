async function getUser(request, env) {
  const auth = request.headers.get("Authorization") || "";
  const token = auth.replace(/^Bearer\s+/i, "");

  if (!token || !env.FIREBASE_API_KEY) return null;

  const response = await fetch(
    `https://identitytoolkit.googleapis.com/v1/accounts:lookup?key=${env.FIREBASE_API_KEY}`,
    {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ idToken: token })
    }
  );

  if (!response.ok) return null;

  const data = await response.json();
  return data.users?.[0]?.localId || null;
}

async function prepareDatabase(db) {
  const columns = await db.prepare(
    "PRAGMA table_info(orders)"
  ).all();

  const names = (columns.results || []).map(c => c.name);

  if (!names.includes("delivery_boy_id")) {
    await db.prepare(
      "ALTER TABLE orders ADD COLUMN delivery_boy_id INTEGER"
    ).run();
  }

  if (!names.includes("assigned_at")) {
    await db.prepare(
      "ALTER TABLE orders ADD COLUMN assigned_at TEXT"
    ).run();
  }
}

export async function onRequest({ request, env }) {
  if (!env.DB) {
    return Response.json({ error: "Database missing" }, { status: 500 });
  }

  try {
    const uid = await getUser(request, env);

    if (!uid) {
      return Response.json({ error: "Please login first" }, { status: 401 });
    }

    await prepareDatabase(env.DB);

    const partner = await env.DB.prepare(`
      SELECT id, name, status
      FROM delivery_boys
      WHERE firebase_uid = ?
    `).bind(uid).first();

    if (!partner || partner.status !== "approved") {
      return Response.json(
        { error: "Delivery account not approved" },
        { status: 403 }
      );
    }

    if (request.method === "GET") {
      const result = await env.DB.prepare(`
        SELECT *
        FROM orders
        WHERE delivery_boy_id = ?
        ORDER BY id DESC
      `).bind(partner.id).all();

      return Response.json(result.results || []);
    }

    if (request.method === "PATCH") {
      const body = await request.json();
      const id = Number(body.id);
      const status = body.status;

      if (!Number.isInteger(id) || id <= 0) {
        return Response.json({ error: "Invalid order ID" }, { status: 400 });
      }

      if (!["Out for Delivery", "Delivered"].includes(status)) {
        return Response.json({ error: "Invalid status" }, { status: 400 });
      }

      const result = await env.DB.prepare(`
        UPDATE orders
        SET status = ?
        WHERE id = ? AND delivery_boy_id = ?
      `).bind(status, id, partner.id).run();

      if (!result.meta?.changes) {
        return Response.json(
          { error: "Order not found or not assigned to you" },
          { status: 404 }
        );
      }

      return Response.json({
        success: true,
        message: "Order status updated",
        status
      });
    }

    return Response.json({ error: "Method not allowed" }, { status: 405 });

  } catch (error) {
    return Response.json({ error: error.message }, { status: 500 });
  }
}
