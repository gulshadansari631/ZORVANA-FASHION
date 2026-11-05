
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
    return Response.json({ error: "Database missing" }, { status: 500 });
  }

  try {
    await env.DB.prepare(`
      CREATE TABLE IF NOT EXISTS products (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        name TEXT NOT NULL,
        category TEXT NOT NULL,
        image TEXT,
        images TEXT DEFAULT '[]',
        selling_price REAL NOT NULL,
        mrp REAL DEFAULT 0,
        discount TEXT,
        description TEXT,
        stock INTEGER DEFAULT 0,
        highlights TEXT DEFAULT '{}',
        additional_details TEXT DEFAULT '{}',
        created_at TEXT DEFAULT CURRENT_TIMESTAMP
      )
    `).run();

    const columns = await env.DB.prepare(
      "PRAGMA table_info(products)"
    ).all();

    const existing = (columns.results || []).map(c => c.name);

    const migrations = [
      ["images", "TEXT DEFAULT '[]'"],
      ["highlights", "TEXT DEFAULT '{}'"],
      ["additional_details", "TEXT DEFAULT '{}'"]
    ];

    for (const [name, type] of migrations) {
      if (!existing.includes(name)) {
        await env.DB.prepare(
          `ALTER TABLE products ADD COLUMN ${name} ${type}`
        ).run();
      }
    }

    if (request.method === "GET") {
      const result = await env.DB.prepare(
        "SELECT * FROM products ORDER BY id DESC"
      ).all();

      const products = (result.results || []).map(p => ({
        ...p,
        images: parseJSON(p.images, p.image ? [p.image] : []),
        highlights: parseJSON(p.highlights, {}),
        additional_details: parseJSON(p.additional_details, {})
      }));

      return Response.json(products);
    }

    if (!verifyAdmin(request, env)) {
      return Response.json({ error: "Unauthorized" }, { status: 401 });
    }

    if (request.method === "POST" || request.method === "PUT") {
      const p = await request.json();

      if (
        !p.name ||
        !p.category ||
        !Number.isFinite(Number(p.selling_price)) ||
        Number(p.selling_price) < 0
      ) {
        return Response.json(
          { error: "Name, category and valid price required" },
          { status: 400 }
        );
      }

      const images = Array.isArray(p.images)
        ? p.images.filter(url => typeof url === "string" && url.startsWith("https://"))
        : [];

      const mainImage = images[0] || p.image || "";

      const values = [
        String(p.name).trim(),
        String(p.category),
        mainImage,
        JSON.stringify(images.length ? images : (mainImage ? [mainImage] : [])),
        Number(p.selling_price),
        Number(p.mrp) || 0,
        String(p.discount || ""),
        String(p.description || ""),
        Math.max(0, Number(p.stock) || 0),
        JSON.stringify(p.highlights || {}),
        JSON.stringify(p.additional_details || {})
      ];

      if (request.method === "POST") {
        const result = await env.DB.prepare(`
          INSERT INTO products
          (name, category, image, images, selling_price, mrp, discount,
           description, stock, highlights, additional_details)
          VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
        `).bind(...values).run();

        return Response.json({
          success: true,
          id: result.meta.last_row_id
        });
      }

      if (!Number(p.id)) {
        return Response.json({ error: "Product ID required" }, { status: 400 });
      }

      await env.DB.prepare(`
        UPDATE products SET
        name=?, category=?, image=?, images=?, selling_price=?, mrp=?,
        discount=?, description=?, stock=?, highlights=?,
        additional_details=?
        WHERE id=?
      `).bind(...values, Number(p.id)).run();

      return Response.json({ success: true });
    }

    if (request.method === "DELETE") {
      const p = await request.json();

      await env.DB.prepare(
        "DELETE FROM products WHERE id=?"
      ).bind(Number(p.id)).run();

      return Response.json({ success: true });
    }

    return new Response("Method not allowed", { status: 405 });

  } catch (error) {
    return Response.json({ error: error.message }, { status: 500 });
  }
}

function parseJSON(value, fallback) {
  try {
    return value ? JSON.parse(value) : fallback;
  } catch {
    return fallback;
  }
}
