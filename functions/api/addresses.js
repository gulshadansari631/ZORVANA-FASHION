
async function getCustomerUid(request, env) {
  const auth = request.headers.get("Authorization") || "";
  const token = auth.startsWith("Bearer ") ? auth.slice(7) : "";

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

export async function onRequest(context) {
  const { request, env } = context;

  try {
    if (!env.DB) {
      return Response.json({ error: "Database not configured" }, { status: 500 });
    }

    const uid = await getCustomerUid(request, env);

    if (!uid) {
      return Response.json({ error: "Please login first" }, { status: 401 });
    }

    await env.DB.prepare(`
      CREATE TABLE IF NOT EXISTS customer_addresses (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        customer_uid TEXT NOT NULL,
        name TEXT NOT NULL,
        phone TEXT NOT NULL,
        pincode TEXT NOT NULL,
        state TEXT NOT NULL,
        district TEXT NOT NULL,
        address TEXT NOT NULL,
        is_default INTEGER DEFAULT 0,
        created_at TEXT DEFAULT CURRENT_TIMESTAMP
      )
    `).run();

    if (request.method === "GET") {
      const result = await env.DB.prepare(
        "SELECT * FROM customer_addresses WHERE customer_uid = ? ORDER BY is_default DESC, id DESC"
      ).bind(uid).all();

      return Response.json(result.results || []);
    }

    if (request.method === "POST") {
      const body = await request.json();

      const fields = [
        body.name, body.phone, body.pincode,
        body.state, body.district, body.address
      ];

      if (fields.some(value => !String(value || "").trim())) {
        return Response.json({ error: "Please fill all address details" }, { status: 400 });
      }

      if (!/^[0-9]{10}$/.test(body.phone)) {
        return Response.json({ error: "Enter valid 10 digit mobile number" }, { status: 400 });
      }

      if (!/^[0-9]{6}$/.test(body.pincode)) {
        return Response.json({ error: "Enter valid 6 digit PIN code" }, { status: 400 });
      }

      const count = await env.DB.prepare(
        "SELECT COUNT(*) AS total FROM customer_addresses WHERE customer_uid = ?"
      ).bind(uid).first();

      const makeDefault = body.is_default || count.total === 0;

      if (makeDefault) {
        await env.DB.prepare(
          "UPDATE customer_addresses SET is_default = 0 WHERE customer_uid = ?"
        ).bind(uid).run();
      }

      const result = await env.DB.prepare(`
        INSERT INTO customer_addresses
        (customer_uid, name, phone, pincode, state, district, address, is_default)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?)
      `).bind(
        uid, body.name.trim(), body.phone.trim(),
        body.pincode.trim(), body.state.trim(),
        body.district.trim(), body.address.trim(),
        makeDefault ? 1 : 0
      ).run();

      return Response.json({ success: true, id: result.meta.last_row_id });
    }

    if (request.method === "PUT") {
      const body = await request.json();

      if (!Number.isInteger(Number(body.id))) {
        return Response.json({ error: "Invalid address ID" }, { status: 400 });
      }

      const result = await env.DB.prepare(`
        UPDATE customer_addresses
        SET name=?, phone=?, pincode=?, state=?, district=?, address=?
        WHERE id=? AND customer_uid=?
      `).bind(
        body.name, body.phone, body.pincode,
        body.state, body.district, body.address,
        Number(body.id), uid
      ).run();

      return Response.json({ success: result.meta.changes > 0 });
    }

    if (request.method === "PATCH") {
      const body = await request.json();

      await env.DB.prepare(
        "UPDATE customer_addresses SET is_default=0 WHERE customer_uid=?"
      ).bind(uid).run();

      const result = await env.DB.prepare(
        "UPDATE customer_addresses SET is_default=1 WHERE id=? AND customer_uid=?"
      ).bind(Number(body.id), uid).run();

      return Response.json({ success: result.meta.changes > 0 });
    }

    if (request.method === "DELETE") {
      const body = await request.json();

      const result = await env.DB.prepare(
        "DELETE FROM customer_addresses WHERE id=? AND customer_uid=?"
      ).bind(Number(body.id), uid).run();

      return Response.json({ success: result.meta.changes > 0 });
    }

    return new Response("Method not allowed", { status: 405 });

  } catch (error) {
    return Response.json({ error: error.message }, { status: 500 });
  }
}
