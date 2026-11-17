
function json(data, status = 200) {
  return new Response(JSON.stringify(data), {
    status,
    headers: {
      "content-type": "application/json; charset=UTF-8",
      "cache-control": "no-store",
      "X-Content-Type-Options": "nosniff"
    }
  });
}

function authorized(request, env) {
  if (!env.ADMIN_TOKEN) return false;

  const auth = request.headers.get("authorization") || "";
  return auth === `Bearer ${env.ADMIN_TOKEN}`;
}

// Existing subscriber dashboard
export async function onRequestGet(context) {
  const { request, env } = context;

  if (!env.DB) {
    return json({
      error: "D1 database binding DB is not configured."
    }, 500);
  }

  if (!authorized(request, env)) {
    return json({ error: "Unauthorized." }, 401);
  }

  try {
    const url = new URL(request.url);
    const q = (url.searchParams.get("q") || "")
      .trim()
      .toLowerCase()
      .slice(0, 200);

    const stats = await env.DB.prepare(`
      SELECT
        COUNT(*) AS total,
        SUM(CASE WHEN status='subscribed' THEN 1 ELSE 0 END) AS active,
        SUM(CASE WHEN status='subscribed'
          AND created_at >= datetime('now','start of month')
          THEN 1 ELSE 0 END) AS new_this_month,
        MAX(created_at) AS latest_signup
      FROM subscribers
    `).first();

    let query = `
      SELECT id, email, source, status, created_at, consent_at
      FROM subscribers
    `;

    const binds = [];

    if (q) {
      query += `
        WHERE lower(email) LIKE ?
        OR lower(source) LIKE ?
      `;
      binds.push(`%${q}%`, `%${q}%`);
    }

    query += `
      ORDER BY datetime(created_at) DESC
      LIMIT 1000
    `;

    let stmt = env.DB.prepare(query);

    if (binds.length) {
      stmt = stmt.bind(...binds);
    }

    const result = await stmt.all();

    return json({
      ok: true,
      stats: {
        total: Number(stats?.total || 0),
        active: Number(stats?.active || 0),
        new_this_month: Number(stats?.new_this_month || 0),
        latest_signup: stats?.latest_signup || null
      },
      subscribers: result.results || []
    });

  } catch (error) {
    console.error("Subscriber list error:", error);

    return json({
      error: "Unable to load subscribers."
    }, 500);
  }
}

// NEW: Permanently delete one subscriber
export async function onRequestDelete(context) {
  const { request, env } = context;

  if (!authorized(request, env)) {
    return json({ error: "Unauthorized." }, 401);
  }

  if (!env.DB) {
    return json({
      error: "D1 database binding DB is not configured."
    }, 503);
  }

  try {
    const contentType =
      request.headers.get("content-type") || "";

    if (!contentType.includes("application/json")) {
      return json({ error: "Invalid request." }, 415);
    }

    const body = await request.json().catch(() => null);
    const id = body?.id;

    if (!Number.isSafeInteger(id) || id < 1) {
      return json({
        error: "A valid subscriber ID is required."
      }, 400);
    }

    const existing = await env.DB.prepare(
      "SELECT id, email FROM subscribers WHERE id = ?"
    ).bind(id).first();

    if (!existing) {
      return json({
        error: "Subscriber not found."
      }, 404);
    }

    const result = await env.DB.prepare(
      "DELETE FROM subscribers WHERE id = ?"
    ).bind(id).run();

    if (result.meta?.changes !== 1) {
      return json({
        error: "Subscriber could not be deleted."
      }, 409);
    }

    return json({
      ok: true,
      deletedId: id,
      message: "Subscriber deleted successfully."
    });

  } catch (error) {
    console.error("Subscriber deletion error:", error);

    return json({
      error: "Unable to delete subscriber."
    }, 500);
  }
}
