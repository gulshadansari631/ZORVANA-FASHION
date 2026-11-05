
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
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ idToken: token })
      }
    );

    if (!response.ok) return null;

    const data = await response.json();
    return data.users?.[0]?.localId || null;
  } catch {
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

function getExpectedDelivery(orderDate) {
  if (!orderDate) return null;

  const parts = String(orderDate).slice(0, 10).split("-").map(Number);

  if (parts.length !== 3 || !parts[0] || !parts[1] || !parts[2]) {
    return null;
  }

  const date = new Date(Date.UTC(parts[0], parts[1] - 1, parts[2]));
  date.setUTCDate(date.getUTCDate() + 8);

  return date.toISOString().slice(0, 10);
}

function clean(value, max = 500) {
  return String(value ?? "").trim().slice(0, max);
}

async function saveOrder(env, customerUid, customer, item) {
  const result = await env.DB.prepare(`
    INSERT INTO orders (
      product, size, customer_name, phone, address,
      state, district, pincode, payment, status,
      customer_uid, product_image, product_price
    )
    VALUES (?, ?, ?, ?, ?, ?, ?, 'Cash on Delivery',
      'Confirmed', ?, ?, ?)
  `).bind(
    item.product,
    item.size,
    customer.name,
    customer.phone,
    customer.address,
    customer.state,
    customer.district,
    customer.pincode,
    customerUid,
    item.image,
    item.price
  ).run();

  const orderId = result.meta.last_row_id;

  await env.DB.prepare(`
    INSERT INTO order_tracking (order_id, status)
    VALUES (?, 'Confirmed')
  `).bind(orderId).run();

  return orderId;
}

export async function onRequest(context) {
  const { request, env } = context;

  if (!env.DB) {
    return Response.json(
      { error: "Database binding DB is missing" },
      { status: 500 }
    );
  }

  // CUSTOMER: PLACE ORDER
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

      const customer = {
        name: clean(form.get("customer_name"), 120),
        phone: clean(form.get("phone"), 10),
        address: clean(form.get("address"), 500),
        state: clean(form.get("state"), 100),
        district: clean(form.get("district"), 100),
        pincode: clean(form.get("pincode"), 6)
      };

      if (
        !customer.name ||
        !/^[0-9]{10}$/.test(customer.phone) ||
        !customer.address ||
        !customer.state ||
        !customer.district ||
        !/^[0-9]{6}$/.test(customer.pincode)
      ) {
        return Response.json(
          { error: "Please enter valid delivery details." },
          { status: 400 }
        );
      }

      let items = [];

      const itemsText = form.get("items");

      if (itemsText) {
        try {
          items = JSON.parse(String(itemsText));
        } catch {
          return Response.json(
            { error: "Invalid cart items." },
            { status: 400 }
          );
        }
      }

      // Backward compatibility with single-product checkout
      if (!Array.isArray(items) || items.length === 0) {
        items = [{
          product: form.get("product"),
          size: form.get("size"),
          image: form.get("product_image"),
          price: form.get("product_price")
        }];
      }

      if (items.length > 30) {
        return Response.json(
          { error: "Maximum 30 cart items allowed." },
          { status: 400 }
        );
      }

      const cleanItems = [];

      for (const item of items) {
        const product = clean(item.product || item.name, 200);
        const size = clean(item.size || "Not selected", 30);
        const image = clean(item.image || item.product_image, 1000);
        const price = clean(item.price || item.product_price, 50);

        if (!product) {
          return Response.json(
            { error: "A cart item has no product name." },
            { status: 400 }
          );
        }

        cleanItems.push({
          product,
          size,
          image: image || null,
          price: price || null
        });
      }

      const orderIds = [];

      for (const item of cleanItems) {
        const orderId = await saveOrder(
          env,
          customerUid,
          customer,
          item
        );

        orderIds.push(orderId);
      }

      return Response.json({
        success: true,
        message: "Order placed successfully.",
        order_ids: orderIds,
        payment: "Cash on Delivery"
      });

    } catch (error) {
      return Response.json(
        { error: "Order save failed: " + error.message },
        { status: 500 }
      );
    }
  }

  // CUSTOMER OR ADMIN: VIEW ORDERS
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
        order.order_date = order.tracking[0]?.updated_at || null;
        order.expected_delivery = getExpectedDelivery(order.order_date);
      }

      return Response.json(orders);

    } catch (error) {
      return Response.json(
        { error: "Could not load orders: " + error.message },
        { status: 500 }
      );
    }
  }

  // CUSTOMER CANCELLATION / ADMIN STATUS UPDATE
  if (request.method === "PATCH") {
    try {
      const customerUid = await verifyCustomer(request, env);

      if (customerUid) {
        const body = await request.json();
        const id = Number(body.id);
        const reason = clean(body.cancel_reason, 300);

        if (!Number.isInteger(id) || id <= 0 || !reason) {
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

  return new Response("Method not allowed", { status: 405 });
}
