export async function onRequest(context) {
  const { request, env } = context;

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

  return new Response("Method not allowed", { status: 405 });
}
