function verifyAdmin(request, env) {
  return Boolean(
    env.ADMIN_EMAIL &&
    env.ADMIN_PASSWORD &&
    request.headers.get("X-Admin-Email") === env.ADMIN_EMAIL &&
    request.headers.get("X-Admin-Password") === env.ADMIN_PASSWORD
  );
}

async function createTable(db) {
  await db.prepare(`
    CREATE TABLE IF NOT EXISTS serviceable_pincodes (
      pincode TEXT PRIMARY KEY,
      office_name TEXT,
      district TEXT,
      state TEXT,
      is_serviceable INTEGER DEFAULT 0,
      updated_at TEXT DEFAULT CURRENT_TIMESTAMP
    )
  `).run();
}

async function getPostalDetails(pin) {
  const response = await fetch(
    "https://api.postalpincode.in/pincode/" + pin
  );

  if (!response.ok) throw new Error("PIN lookup failed");

  const data = await response.json();
  const offices = data?.[0]?.PostOffice;

  if (data?.[0]?.Status !== "Success" ||
      !Array.isArray(offices) ||
      !offices.length) return null;

  const p = offices[0];

  return {
    office_name: p.Name || "",
    district: p.District || "",
    state: p.State || ""
  };
}

export async function onRequest({ request, env }) {
  if (!env.DB) {
    return Response.json({ error: "Database missing" }, { status: 500 });
  }

  try {
    await createTable(env.DB);

    const url = new URL(request.url);

    if (request.method === "GET") {
      if (url.searchParams.get("all") === "1") {
        if (!verifyAdmin(request, env)) {
          return Response.json({ error: "Unauthorized" }, { status: 401 });
        }

        const result = await env.DB.prepare(
          "SELECT * FROM serviceable_pincodes ORDER BY state, district"
        ).all();

        return Response.json(result.results || []);
      }

      const pin = String(url.searchParams.get("pin") || "");

      if (!/^[0-9]{6}$/.test(pin)) {
        return Response.json({
          error: "Enter valid 6 digit PIN code"
        }, { status: 400 });
      }

      const postal = await getPostalDetails(pin);

      if (!postal) {
        return Response.json({
          valid: false,
          serviceable: false,
          message: "Invalid PIN code"
        });
      }

      const saved = await env.DB.prepare(
        "SELECT is_serviceable FROM serviceable_pincodes WHERE pincode = ?"
      ).bind(pin).first();

      const available = Number(saved?.is_serviceable || 0) === 1;

      return Response.json({
        valid: true,
        serviceable: available,
        pincode: pin,
        ...postal,
        message: available
          ? "Delivery available"
          : "Delivery unavailable"
      });
    }

    if (request.method === "POST") {
      if (!verifyAdmin(request, env)) {
        return Response.json({ error: "Unauthorized" }, { status: 401 });
      }

      const body = await request.json();
      const pin = String(body.pincode || "");

      if (!/^[0-9]{6}$/.test(pin)) {
        return Response.json({ error: "Invalid PIN code" }, { status: 400 });
      }

      const postal = await getPostalDetails(pin);

      if (!postal) {
        return Response.json({ error: "PIN code not found" }, { status: 404 });
      }

      const available =
        body.is_serviceable === true ||
        Number(body.is_serviceable) === 1;

      await env.DB.prepare(`
        INSERT INTO serviceable_pincodes
        (pincode, office_name, district, state, is_serviceable)
        VALUES (?, ?, ?, ?, ?)
        ON CONFLICT(pincode) DO UPDATE SET
          office_name = excluded.office_name,
          district = excluded.district,
          state = excluded.state,
          is_serviceable = excluded.is_serviceable,
          updated_at = CURRENT_TIMESTAMP
      `).bind(
        pin,
        postal.office_name,
        postal.district,
        postal.state,
        available ? 1 : 0
      ).run();

      return Response.json({
        success: true,
        pincode: pin,
        is_serviceable: available,
        ...postal
      });
    }

    return new Response("Method not allowed", { status: 405 });

  } catch (error) {
    return Response.json({
      error: error.message
    }, { status: 500 });
  }
}
