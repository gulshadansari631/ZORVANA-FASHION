
import { checkAdminCredentials } from "../../lib/admin-auth.js";

export async function onRequestPost({ request, env }) {
  const result = await checkAdminCredentials(request, env);

  if (!result.ok) {
    return Response.json(
      {
        success: false,
        error: result.message,
        code: result.code
      },
      {
        status: 401,
        headers: { "Cache-Control": "no-store" }
      }
    );
  }

  return Response.json(
    {
      success: true,
      message: "Admin login successful."
    },
    {
      headers: { "Cache-Control": "no-store" }
    }
  );
}
