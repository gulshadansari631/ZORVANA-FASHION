export async function onRequest({request, env}) {
  if (request.method !== "POST") {
    return Response.json({error:"Method not allowed"},{status:405});
  }

  if (!env.DB || !env.FIREBASE_API_KEY) {
    return Response.json({error:"Server configuration missing"},{status:500});
  }

  try {
    const body = await request.json();
    const phone = String(body.phone || "").trim();
    const password = String(body.password || "");

    if (!/^[0-9]{10}$/.test(phone) || password.length < 6) {
      return Response.json({error:"Invalid login details"},{status:400});
    }

    const partner = await env.DB.prepare(`
      SELECT id, firebase_uid, email, name, phone, status
      FROM delivery_boys
      WHERE phone = ?
      ORDER BY id DESC
      LIMIT 1
    `).bind(phone).first();

    if (!partner) {
      return Response.json({error:"Mobile number not registered"},{status:401});
    }

    if (partner.status !== "approved") {
      return Response.json({
        error:"Account is not approved",
        status:partner.status
      },{status:403});
    }

    const response = await fetch(
      `https://identitytoolkit.googleapis.com/v1/accounts:signInWithPassword?key=${env.FIREBASE_API_KEY}`,
      {
        method:"POST",
        headers:{"Content-Type":"application/json"},
        body:JSON.stringify({
          email:partner.email,
          password,
          returnSecureToken:true
        })
      }
    );

    const result = await response.json();

    if (!response.ok || result.localId !== partner.firebase_uid) {
      return Response.json({error:"Incorrect mobile number or password"},{status:401});
    }

    return Response.json({
      success:true,
      idToken:result.idToken,
      refreshToken:result.refreshToken,
      expiresIn:result.expiresIn,
      name:partner.name,
      phone:partner.phone
    });

  } catch(error) {
    return Response.json({error:"Login failed"},{status:500});
  }
}
