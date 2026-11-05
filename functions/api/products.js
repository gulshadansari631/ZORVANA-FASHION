
function verifyAdmin(request, env) {
  return Boolean(
    env.ADMIN_EMAIL &&
    env.ADMIN_PASSWORD &&
    request.headers.get("X-Admin-Email") === env.ADMIN_EMAIL &&
    request.headers.get("X-Admin-Password") === env.ADMIN_PASSWORD
  );
}

export async function onRequest({ request, env }) {
  if (!env.DB) {
    return Response.json(
      { error: "Database missing" },
      { status: 500 }
    );
  }

  if (!verifyAdmin(request, env)) {
    return Response.json(
      { error: "Unauthorized" },
      { status: 401 }
    );
  }

  try {
    await env.DB.prepare(`
      CREATE TABLE IF NOT EXISTS products (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        name TEXT NOT NULL,
        category TEXT NOT NULL,
        image TEXT,
        selling_price REAL NOT NULL,
        mrp REAL,
        discount TEXT,
        description TEXT,
        stock INTEGER DEFAULT 0,
        created_at TEXT DEFAULT CURRENT_TIMESTAMP
      )
    `).run();

    if (request.method === "GET") {
      const result = await env.DB.prepare(
        "SELECT * FROM products ORDER BY id DESC"
      ).all();

      return Response.json(result.results || []);
    }

    if (request.method === "POST") {
      const p = await request.json();

      if (
        !p.name ||
        !p.category ||
        !Number.isFinite(Number(p.selling_price))
      ) {
        return Response.json(
          { error: "Name, category and price required" },
          { status: 400 }
        );
      }

      const result = await env.DB.prepare(`
        INSERT INTO products
        (name, category, image, selling_price, mrp, discount, description, stock)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?)
      `).bind(
        String(p.name).trim(),
        String(p.category),
        p.image || "",
        Number(p.selling_price),
        Number(p.mrp) || 0,
        p.discount || "",
        p.description || "",
        Math.max(0, Number(p.stock) || 0)
      ).run();

      return Response.json({
        success: true,
        id: result.meta.last_row_id
      });
    }

    if (request.method === "PUT") {
      const p = await request.json();

      await env.DB.prepare(`
        UPDATE products SET
        name=?, category=?, image=?, selling_price=?,
        mrp=?, discount=?, description=?, stock=?
        WHERE id=?
      `).bind(
        String(p.name).trim(),
        String(p.category),
        p.image || "",
        Number(p.selling_price),
        Number(p.mrp) || 0,
        p.discount || "",
        p.description || "",
        Math.max(0, Number(p.stock) || 0),
        Number(p.id)
      ).run();

      return Response.json({ success: true });
    }

    if (request.method === "DELETE") {
      const p = await request.json();

      await env.DB.prepare(
        "DELETE FROM products WHERE id=?"
      ).bind(Number(p.id)).run();

      return Response.json({ success: true });
    }

    return new Response("Method not allowed", {
      status: 405
    });

  } catch (error) {
    return Response.json(
      { error: error.message },
      { status: 500 }
    );
  }
}
