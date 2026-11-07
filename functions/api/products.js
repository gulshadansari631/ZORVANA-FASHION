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
        product_type TEXT DEFAULT '',
        image TEXT,
        images TEXT DEFAULT '[]',
        selling_price REAL NOT NULL,
        mrp REAL DEFAULT 0,
        discount TEXT,
        description TEXT,
        stock INTEGER DEFAULT 0,
        highlights TEXT DEFAULT '{}',
        additional_details TEXT DEFAULT '{}',
        sizes TEXT DEFAULT '[]',
        created_at TEXT DEFAULT CURRENT_TIMESTAMP
      )
    `).run();

    const columns = await env.DB.prepare(
      "PRAGMA table_info(products)"
    ).all();

    const existing = (columns.results || []).map(c => c.name);

    const migrations = [
      ["product_type", "TEXT DEFAULT ''"],
            ["variant_group_id", "TEXT DEFAULT ''"],
      ["images", "TEXT DEFAULT '[]'"],
      ["highlights", "TEXT DEFAULT '{}'"],
      ["additional_details", "TEXT DEFAULT '{}'"],
      ["sizes", "TEXT DEFAULT '[]'"]
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
        additional_details: parseJSON(p.additional_details, {}),
        sizes: parseJSON(p.sizes, [])
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

            const allowedSizes = [
        "XS", "S", "M", "L", "XL", "XXL", "XXXL",
        "28", "30", "32", "34", "36", "38", "40", "42", "44",
        "UK 6", "UK 7", "UK 8", "UK 9", "UK 10", "UK 11",
        "6 Months", "9 Months", "12 Months", "18 Months",
        "2-3 Years", "3-4 Years", "4-5 Years", "5-6 Years",
        "6-7 Years", "7-8 Years", "8-9 Years", "9-10 Years",
        "10-11 Years", "11-12 Years", "12-13 Years",
        "13-14 Years", "14-15 Years",
        "Free Size", "Not applicable"
      ];

      const sizes = Array.isArray(p.sizes)
        ? [...new Set(p.sizes.map(String).filter(size => allowedSizes.includes(size)))]
        : [];

      const values = [
        String(p.name).trim(),
        String(p.category),
                String(p.product_type || ""),
        String(p.variant_group_id || ""),
        mainImage,
        JSON.stringify(images.length ? images : (mainImage ? [mainImage] : [])),
        Number(p.selling_price),
        Number(p.mrp) || 0,
        String(p.discount || ""),
        String(p.description || ""),
        Math.max(0, Number(p.stock) || 0),
        JSON.stringify(p.highlights || {}),
        JSON.stringify(p.additional_details || {}),
        JSON.stringify(sizes)
      ];

      if (request.method === "POST") {
        const result = await env.DB.prepare(`
          INSERT INTO products
                (name, category, product_type, variant_group_id, image, images, selling_price, mrp,
       discount, description, stock, highlights, additional_details, sizes)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
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
                name=?, category=?, product_type=?, variant_group_id=?, image=?, images=?,
        selling_price=?, mrp=?, discount=?, description=?, stock=?,
        highlights=?, additional_details=?, sizes=?
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
