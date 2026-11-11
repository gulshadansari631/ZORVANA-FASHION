import { verifyAdmin } from "../../lib/admin-auth.js";
export async function onRequest({request, env}) {
  if (!env.DB) {
    return Response.json({error:"Database missing"},{status:500});
  }

  if (!verifyAdmin(request,env)) {
    return Response.json({error:"Unauthorized"},{status:401});
  }

  try {
    await env.DB.prepare(`
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

    if (request.method === "GET") {
      const result = await env.DB.prepare(
        "SELECT id,name,email,phone,vehicle_type,vehicle_number,status,created_at FROM delivery_boys ORDER BY id DESC"
      ).all();

      return Response.json(result.results || []);
    }

    if (request.method === "PATCH") {
      const body = await request.json();
      const id = Number(body.id);
      const status = String(body.status || "");

      if (
        !Number.isInteger(id) || id <= 0 ||
        !["approved","rejected","suspended"].includes(status)
      ) {
        return Response.json({error:"Invalid details"},{status:400});
      }

      const result = await env.DB.prepare(`
        UPDATE delivery_boys
        SET status=?, updated_at=CURRENT_TIMESTAMP
        WHERE id=?
      `).bind(status,id).run();

      if (!result.meta.changes) {
        return Response.json({error:"Not found"},{status:404});
      }

      return Response.json({
        success:true,
        message:"Status updated successfully"
      });
    }

    return new Response("Method not allowed",{status:405});

  } catch(error) {
    return Response.json({error:error.message},{status:500});
  }
}
