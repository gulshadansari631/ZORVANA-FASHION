

export async function onRequest(context) {
  const { request, env } = context;

  // Save customer order
  if (request.method === "POST") {
    try {
      const form = await request.formData();

      await env.DB.prepare(`
        INSERT INTO orders (
          product, size, customer_name, phone, address,
          state, district, pincode, payment
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
      `).bind(
        form.get("product"),
        form.get("size"),
        form.get("customer_name"),
        form.get("phone"),
        form.get("address"),
        form.get("state"),
        form.get("district"),
        form.get("pincode"),
        form.get("payment") || "Cash on Delivery"
      ).run();

      return Response.redirect(
        new URL("/order-success.html", request.url),
        303
      );
    } catch (error) {
      return new Response("Order save failed", { status: 500 });
    }
  }

  // Verify admin email and password
  const email = request.headers.get("X-Admin-Email");
  const password = request.headers.get("X-Admin-Password");

  if (
    !env.ADMIN_EMAIL ||
    !env.ADMIN_PASSWORD ||
    email !== env.ADMIN_EMAIL ||
    password !== env.ADMIN_PASSWORD
  ) {
    return Response.json({ error: "Unauthorized" }, { status: 401 });
  }

  // Show all orders
  if (request.method === "GET") {
    const result = await env.DB.prepare(
      "SELECT * FROM orders ORDER BY id DESC"
    ).all();

    return Response.json(result.results || []);
  }

  // Update order status
  if (request.method === "PATCH") {
    try {
      const body = await request.json();
      const allowed = ["Confirmed", "Cancelled", "Delivered"];

      if (!body.id || !allowed.includes(body.status)) {
        return Response.json({ error: "Invalid request" }, { status: 400 });
      }

      const result = await env.DB.prepare(
        "UPDATE orders SET status = ? WHERE id = ?"
      ).bind(body.status, body.id).run();

      if (!result.meta.changes) {
        return Response.json({ error: "Order not found" }, { status: 404 });
      }

      return Response.json({ success: true });
    } catch (error) {
      return Response.json({ error: "Update failed" }, { status: 500 });
    }
  }

  return new Response("Method not allowed", { status: 405 });
}
