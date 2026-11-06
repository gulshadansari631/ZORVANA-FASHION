async function getIdentity(request, env) {
  const auth = request.headers.get("Authorization") || "";
  const token = auth.startsWith("Bearer ") ? auth.slice(7) : "";

  if (!token || !env.FIREBASE_API_KEY) return null;

  const response = await fetch(
    `https://identitytoolkit.googleapis.com/v1/accounts:lookup?key=${env.FIREBASE_API_KEY}`,
    {
      method: "POST",
      headers: {"Content-Type": "application/json"},
      body: JSON.stringify({idToken: token})
    }
  );

  if (!response.ok) return null;

  const data = await response.json();
  const user = data.users?.[0];

  return user?.localId && user?.email
    ? {uid: user.localId, email: user.email}
    : null;
}

async function createTable(db) {
  await db.prepare(`
    CREATE TABLE IF NOT EXISTS delivery_boys (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      firebase_uid TEXT NOT NULL UNIQUE,
      name TEXT NOT NULL,
      email TEXT NOT NULL,
      phone TEXT NOT NULL,
      vehicle_type TEXT NOT NULL,
      vehicle_number TEXT NOT NULL,
      status TEXT DEFAULT 'pending',
      created_at TEXT DEFAULT CURRENT_TIMESTAMP,
      updated_at TEXT DEFAULT CURRENT_TIMESTAMP
    )
  `).run();
}

export async function onRequest({request, env}) {
  if (!env.DB) {
    return Response.json({error:"Database missing"}, {status:500});
  }

  try {
    const user = await getIdentity(request, env);

    if (!user) {
      return Response.json({error:"Please login first"}, {status:401});
    }

    await createTable(env.DB);

    if (request.method === "GET") {
      const profile = await env.DB.prepare(
        "SELECT id,name,email,phone,vehicle_type,vehicle_number,status FROM delivery_boys WHERE firebase_uid=?"
      ).bind(user.uid).first();

      return Response.json({profile:profile || null});
    }

    if (request.method === "POST") {
      const body = await request.json();

      const name = String(body.name || "").trim();
      const phone = String(body.phone || "").trim();
      const vehicle = String(body.vehicle_type || "").trim();
      const number = String(body.vehicle_number || "").trim().toUpperCase();

      if (!name || !/^[0-9]{10}$/.test(phone) ||
          !vehicle || !number) {
        return Response.json(
          {error:"Please enter valid details"},
          {status:400}
        );
      }

      const existing = await env.DB.prepare(
        "SELECT id,status FROM delivery_boys WHERE firebase_uid=?"
      ).bind(user.uid).first();

      if (existing && existing.status !== "pending") {
        return Response.json(
          {error:"Application already processed",status:existing.status},
          {status:409}
        );
      }

      if (existing) {
        await env.DB.prepare(`
          UPDATE delivery_boys
          SET name=?,phone=?,vehicle_type=?,vehicle_number=?,
          updated_at=CURRENT_TIMESTAMP
          WHERE firebase_uid=? AND status='pending'
        `).bind(name,phone,vehicle,number,user.uid).run();
      } else {
        await env.DB.prepare(`
          INSERT INTO delivery_boys
          (firebase_uid,name,email,phone,vehicle_type,vehicle_number)
          VALUES (?,?,?,?,?,?)
        `).bind(
          user.uid,name,user.email,phone,vehicle,number
        ).run();
      }

      return Response.json({
        success:true,
        message:"Application submitted. Waiting for admin approval."
      });
    }

    return new Response("Method not allowed",{status:405});

  } catch(error) {
    return Response.json(
      {error:"Server error: "+error.message},
      {status:500}
    );
  }
}
