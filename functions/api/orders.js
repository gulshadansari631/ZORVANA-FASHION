
async function verifyCustomer(request, env) {
  const authHeader = request.headers.get("Authorization") || "";
  const token = authHeader.startsWith("Bearer ")
    ? authHeader.slice(7)
    : "";

  if (!token || !env.FIREBASE_API_KEY) return null;

  try {
    const response = await fetch(
      `https://identitytoolkit.googleapis.com/v1/accounts:lookup?key=${env.FIREBASE_API_KEY}`,
      {
        method: "POST",
        headers: {
          "Content-Type": "application/json"
        },
        body: JSON.stringify({ idToken: token })
      }
    );

    if (!response.ok) return null;

    const data = await response.json();
    return data.users?.[0]?.localId || null;

  } catch (error) {
    return null;
  }
}

function verifyAdmin(request, env) {
  return Boolean(
    env.ADMIN_EMAIL &&
    env.ADMIN_PASSWORD &&
    request.headers.get("X-Admin-Email") === env.ADMIN_EMAIL &&
    request.headers.get("X-Admin-Password") === env.ADMIN_PASSWORD
  );
}

// Expected delivery: 8 calendar days after order confirmation
function getExpectedDelivery(orderDate) {
  if (!orderDate) return null;

  const datePart = String(orderDate).slice(0, 10);
  const parts = datePart.split("-").map(Number);

  if (
    parts.length !== 3 ||
    !parts[0] ||
    !parts[1] ||
    !parts[2]
  ) {
    return null;
  }

  const date = new Date(Date.UTC(
    parts[0],
    parts[1] - 1,
    parts[2]
  ));

  date.setUTCDate(date.getUTCDate() + 8);

  return date.toISOString().slice(0, 10);
}

export async function onRequest(context) {
  const { request, env } = context;

  if (!env.DB) {
    return Response.json(
      { error: "Database binding DB is missing" },
      { status: 500 }
    );
  }

  // CUSTOMER: SAVE ORDER
  if (request.method === "POST") {
    try {
      const customerUid = await verifyCustomer(request, env);

      if (!customerUid) {
        return Response.json(
          { error: "Please login first" },
          { status: 401 }
        );
      }

      const form = await request.formData();

      const product = form.get("product");
      const size = form.get("size");
      const customerName = form.get("customer_name");
      const phone = form.get("phone");
      const address = form.get("address");
      const state = form.get("state");
      const district = form.get("district");
      const pincode = form.get("pincode");
      const payment = form.get("payment") || "Cash on Delivery";
      const productImage = form.get("product_image") || null;
      const productPrice = form.get("product_price") || null;

      if (
        !product ||
        !customerName ||
        !phone ||
        !address ||
        !state ||
        !district ||
        !pincode
      ) {
        return Response.json(
          { error: "Please fill all order details" },
          { status: 400 }
        );
      }

      const result = await env.DB.prepare(`
        INSERT INTO orders (
          product,
          size,
          customer_name,
          phone,
          address,
          state,
          district,
          pincode,
          payment,
          status,
          customer_uid,
          product_image,
          product_price
        )
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, 'Confirmed', ?, ?, ?)
      `).bind(
        product,
        size,
        customerName,
        phone,
        address,
        state,
        district,
        pincode,
        payment,
        customerUid,
        productImage,
        productPrice
      ).run();

      const orderId = result.meta.last_row_id;

      await env.DB.prepare(`
        INSERT INTO order_tracking (order_id, status)
        VALUES (?, 'Confirmed')
      `).bind(orderId).run();

      return Response.redirect(
        new URL("/order-success.html", request.url),
        303
      );

    } catch (error) {
      return Response.json(
        { error: "Order save failed: " + error.message },
        { status: 500 }
      );
    }
  }

  // ADMIN OR CUSTOMER: GET ORDERS
  if (request.method === "GET") {
    try {
      let result;

      if (verifyAdmin(request, env)) {
        result = await env.DB.prepare(`
          SELECT * FROM orders ORDER BY id DESC
        `).all();

      } else {
        const customerUid = await verifyCustomer(request, env);

        if (!customerUid) {
          return Response.json(
            { error: "Unauthorized. Please login." },
            { status: 401 }
          );
        }

        result = await env.DB.prepare(`
          SELECT * FROM orders
          WHERE customer_uid = ?
          ORDER BY id DESC
        `).bind(customerUid).all();
      }

      const orders = result.results || [];

      for (const order of orders) {
        const history = await env.DB.prepare(`
          SELECT status, updated_at
          FROM order_tracking
          WHERE order_id = ?
          ORDER BY id ASC
        `).bind(order.id).all();

        order.tracking = history.results || [];

        // First tracking entry is the original confirmation date
        order.order_date =
          order.tracking[0]?.updated_at || null;

        order.expected_delivery =
          getExpectedDelivery(order.order_date);
      }

      return Response.json(orders);

    } catch (error) {
      return Response.json(
        { error: "Could not load orders: " + error.message },
        { status: 500 }
      );
    }
  }

   // CUSTOMER OR ADMIN: UPDATE ORDER STATUS
  if (request.method === "PATCH") {
    try {
      const customerUid = await verifyCustomer(request, env);

      // CUSTOMER ORDER CANCELLATION
      if (customerUid) {
        const body = await request.json();
        const id = Number(body.id);
        const reason = String(body.cancel_reason || "").trim();

        if (!Number.isInteger(id) || id <= 0 || !reason || reason.length > 300) {
          return Response.json(
            { error: "Invalid order ID or cancellation reason." },
            { status: 400 }
          );
        }

        const columns = await env.DB.prepare(
          "PRAGMA table_info(orders)"
        ).all();

        const hasCancelReason = (columns.results || []).some(
          column => column.name === "cancel_reason"
        );

        if (!hasCancelReason) {
          await env.DB.prepare(
            "ALTER TABLE orders ADD COLUMN cancel_reason TEXT"
          ).run();
        }

        const result = await env.DB.prepare(`
          UPDATE orders
          SET status = 'Cancelled', cancel_reason = ?
          WHERE id = ? AND customer_uid = ? AND status = 'Confirmed'
        `).bind(reason, id, customerUid).run();

        if (!result.meta.changes) {
          return Response.json(
            { error: "Only confirmed orders can be cancelled." },
            { status: 400 }
          );
        }

        await env.DB.prepare(`
          INSERT INTO order_tracking (order_id, status)
          VALUES (?, 'Cancelled')
        `).bind(id).run();

        return Response.json({
          success: true,
          message: "Order cancelled successfully"
        });
      }

      // ADMIN ORDER STATUS UPDATE
      if (!verifyAdmin(request, env)) {
        return Response.json(
          { error: "Unauthorized" },
          { status: 401 }
        );
      }

      const body = await request.json();
      const id = Number(body.id);

      const allowedStatuses = [
        "Confirmed",
        "Shipped",
        "Out for Delivery",
        "Delivered",
        "Cancelled"
      ];

      if (
        !Number.isInteger(id) ||
        id <= 0 ||
        !allowedStatuses.includes(body.status)
      ) {
        return Response.json(
          { error: "Invalid order ID or status" },
          { status: 400 }
        );
      }

      const result = await env.DB.prepare(`
        UPDATE orders SET status = ? WHERE id = ?
      `).bind(body.status, id).run();

      if (!result.meta.changes) {
        return Response.json(
          { error: "Order not found" },
          { status: 404 }
        );
      }

      await env.DB.prepare(`
        INSERT INTO order_tracking (order_id, status)
        VALUES (?, ?)
      `).bind(id, body.status).run();

      return Response.json({
        success: true,
        message: "Order status updated"
      });

    } catch (error) {
      return Response.json(
        { error: "Update failed: " + error.message },
        { status: 500 }
      );
    }
  }

  return new Response("Method not allowed", {
    status: 405
  });
}
