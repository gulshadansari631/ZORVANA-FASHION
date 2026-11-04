
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

  // CUSTOMER: Save new order
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
          state, district, pincode, payment, customer_uid
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
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
        customerUid
      ).run();

      const orderId = result.meta.last_row_id;

      await env.DB.prepare(`
        INSERT INTO order_tracking (order_id, status)
        VALUES (?, 'Pending')
      `).bind(orderId).run();

      return Response.redirect(
        new URL("/order-success.html", request.url),
        303
      );

    } catch (error) {
      return Response.json({ error: "Order save failed" }, { status: 500 });
    }
  }

  // ADMIN OR CUSTOMER: View orders with tracking history
  if (request.method === "GET") {
    try {
      let orders;

      if (verifyAdmin(request, env)) {
        const result = await env.DB.prepare(
          "SELECT * FROM orders ORDER BY id DESC"
        ).all();
        orders = result.results || [];
      } else {
        const customerUid = await verifyCustomer(request);

        if (!customerUid) {
          return Response.json({ error: "Unauthorized" }, { status: 401 });
        }

        const result = await env.DB.prepare(
          "SELECT * FROM orders WHERE customer_uid = ? ORDER BY id DESC"
        ).bind(customerUid).all();

        orders = result.results || [];
      }

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

  // ADMIN: Update order status and save tracking history
  if (request.method === "PATCH") {
    if (!verifyAdmin(request, env)) {
      return Response.json({ error: "Unauthorized" }, { status: 401 });
    }

    try {
      const body = await request.json();

      const allowed = [
        "Confirmed",
        "Shipped",
        "Out for Delivery",
        "Delivered",
        "Cancelled"
      ];

      const orderId = Number(body.id);

      if (!Number.isInteger(orderId) || orderId <= 0 ||
          !allowed.includes(body.status)) {
        return Response.json({ error: "Invalid request" }, { status: 400 });
      }

      const result = await env.DB.prepare(
        "UPDATE orders SET status = ? WHERE id = ?"
      ).bind(body.status, orderId).run();

      if (!result.meta.changes) {
        return Response.json({ error: "Order not found" }, { status: 404 });
      }

      await env.DB.prepare(`
        INSERT INTO order_tracking (order_id, status)
        VALUES (?, ?)
      `).bind(orderId, body.status).run();

      return Response.json({ success: true });

    } catch (error) {
      return Response.json({ error: "Update failed" }, { status: 500 });
    }
  }

  return new Response("Method not allowed", { status: 405 });
}
