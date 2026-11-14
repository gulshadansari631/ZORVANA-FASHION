import { verifyFirebaseUser, isOwner } from "../../lib/admin-auth.js";

export async function onRequestPost({ request, env }) {
  const user = await verifyFirebaseUser(request, env);

  if (!user) {
    return Response.json(
      { success: false, error: "Email verification required. Please sign in again." },
      { status: 401, headers: { "Cache-Control": "no-store" } }
    );
  }

  if (isOwner(user.email, env)) {
    return Response.json(
      { success: true, status: "approved", owner: true },
      { headers: { "Cache-Control": "no-store" } }
    );
  }

  return Response.json(
    {
      success: false,
      status: "migration_required",
      error: "Please use the new access request system."
    },
    { status: 403, headers: { "Cache-Control": "no-store" } }
  );
}
