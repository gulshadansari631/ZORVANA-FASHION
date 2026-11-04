
async function verifyCustomer(request) {
  const auth = request.headers.get("Authorization") || "";
  const token = auth.startsWith("Bearer ") ? auth.slice(7) : "";
  if (!token) return null;

  const response = await fetch(
    "https://identitytoolkit.googleapis.com/v1/accounts:lookup?key=AIzaSyDhCeF2z7VtPggUnwB9u7C-meNhZB-_7h0",
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

function verifyAdmin(request, env) {
  return Boolean(
    env.ADMIN_EMAIL &&
    env.ADMIN_PASSWORD &&
    request.headers.get("X-Admin-Email") === env.ADMIN_EMAIL &&
    request.headers.get("X-Admin-Password") === env.ADMIN_PASSWORD
  );
}

export async function onRequest(context) {
  const { request, env } = context;

  // CUSTOMER: Save order
  if (request.method === "POST") {
    try {
      const customerUid = await verifyCustomer(request);
      if (!customerUid) {
        return Response.json({ error: "Please login first" }, { status: 401 });
      }

      const form = await request.formData();

      const result = await env.DB.prepare(`
        INSERT INTO orders (
  product, size, customer_name, phone, address,
  state, district, pincode, payment, status, customer_uid,
  product_image, product_price
) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, 'Confirmed', ?, ?, ?)
      `).bind(
        form.get("product"),
        form.get("size"),
        form.get("customer_name"),
        form.get("phone"),
        form.get("address"),
        form.get("state"),
        form.get("district"),
        form.get("pincode"),
        form.get("payment") || "Cash on Delivery",
        customerUid,
        form.get("product_image"),
        form.get("product_price")
      ).run();

      await env.DB.prepare(`
        INSERT INTO order_tracking (order_id, status)
        VALUES (?, 'Confirmed')
      `).bind(result.meta.last_row_id).run();

      return Response.redirect(
        new URL("/order-success.html", request.url), 303
      );

    } catch (error) {
      return Response.json({ error: "Order save failed" }, { status: 500 });
    }
  }

  // ADMIN OR CUSTOMER: Get orders and tracking
  if (request.method === "GET") {
    try {
      let result;

      if (verifyAdmin(request, env)) {
        result = await env.DB.prepare(
          "SELECT * FROM orders ORDER BY id DESC"
        ).all();
      } else {
        const customerUid = await verifyCustomer(request);
        if (!customerUid) {
          return Response.json({ error: "Unauthorized" }, { status: 401 });
        }

        result = await env.DB.prepare(
          "SELECT * FROM orders WHERE customer_uid = ? ORDER BY id DESC"
        ).bind(customerUid).all();
      }

      const orders = result.results || [];

      for (const order of orders) {
        const history = await env.DB.prepare(
          "SELECT status, updated_at FROM order_tracking WHERE order_id = ? ORDER BY id ASC"
        ).bind(order.id).all();

        order.tracking = history.results || [];
      }

      return Response.json(orders);

    } catch (error) {
      return Response.json({ error: "Could not load orders" }, { status: 500 });
    }
  }

  // ADMIN: Update status and save history
  if (request.method === "PATCH") {
    if (!verifyAdmin(request, env)) {
      return Response.json({ error: "Unauthorized" }, { status: 401 });
    }

    try {
      const body = await request.json();
      const id = Number(body.id);

      const allowed = [
        "Confirmed", "Shipped",
        "Out for Delivery", "Delivered", "Cancelled"
      ];

      if (!Number.isInteger(id) || id <= 0 || !allowed.includes(body.status)) {
        return Response.json({ error: "Invalid request" }, { status: 400 });
      }

      const result = await env.DB.prepare(
        "UPDATE orders SET status = ? WHERE id = ?"
      ).bind(body.status, id).run();

      if (!result.meta.changes) {
        return Response.json({ error: "Order not found" }, { status: 404 });
      }

      await env.DB.prepare(`
        INSERT INTO order_tracking (order_id, status)
        VALUES (?, ?)
      `).bind(id, body.status).run();

      return Response.json({ success: true });

    } catch (error) {
      return Response.json({ error: "Update failed" }, { status: 500 });
    }
  }

  return new Response("Method not allowed", { status: 405 });
}
