
function json(data, status = 200) {
  return Response.json(data, {
    status,
    headers: {
      "Cache-Control": "private, no-store",
      "X-Content-Type-Options": "nosniff"
    }
  });
}

function authorized(request, env) {
  if (!env.ADMIN_TOKEN) return false;

  const auth =
    request.headers.get("authorization") || "";

  return auth === `Bearer ${env.ADMIN_TOKEN}`;
}

export async function onRequestGet(context) {
  const { request, env } = context;

  if (!authorized(request, env)) {
    return json({ error: "Unauthorized." }, 401);
  }

  if (!env.DB) {
    return json({
      error: "Database is not configured."
    }, 503);
  }

  try {
    const result = await env.DB.prepare(`
      SELECT
        id,
        subscriber_id,
        email,
        action,
        created_at
      FROM subscriber_activity
      ORDER BY id DESC
      LIMIT 100
    `).all();

    return json({
      ok: true,
      activity: result.results || []
    });

  } catch (error) {
    console.error("Subscriber activity error:", error);

    return json({
      error: "Unable to load subscriber activity."
    }, 500);
  }
}

export function onRequestPost() {
  return json({ error: "Method not allowed." }, 405);
}
