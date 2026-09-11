function json(data, status = 200) {
  return new Response(JSON.stringify(data), {
    status,
    headers: {
      "content-type": "application/json; charset=UTF-8",
      "cache-control": "no-store"
    }
  });
}

function authorized(request, env) {
  if (!env.ADMIN_TOKEN) return false;
  const auth = request.headers.get("authorization") || "";
  return auth === `Bearer ${env.ADMIN_TOKEN}`;
}

export async function onRequestGet(context) {
  const { request, env } = context;

  if (!env.DB) {
    return json({ error: "D1 database binding DB is not configured." }, 500);
  }

  if (!authorized(request, env)) {
    return json({ error: "Unauthorized." }, 401);
  }

  try {
    const url = new URL(request.url);
    const q = (url.searchParams.get("q") || "").trim().toLowerCase().slice(0, 200);

    const stats = await env.DB.prepare(`
      SELECT
        COUNT(*) AS total,
        SUM(CASE WHEN status='subscribed' THEN 1 ELSE 0 END) AS active,
        SUM(CASE WHEN status='subscribed'
          AND created_at >= datetime('now','start of month') THEN 1 ELSE 0 END) AS new_this_month,
        MAX(created_at) AS latest_signup
      FROM subscribers
    `).first();

    let query = `
      SELECT id, email, source, status, created_at, consent_at
      FROM subscribers
    `;
    const binds = [];

    if (q) {
      query += ` WHERE lower(email) LIKE ? OR lower(source) LIKE ? `;
      binds.push(`%${q}%`, `%${q}%`);
    }

    query += ` ORDER BY datetime(created_at) DESC LIMIT 1000`;

    let stmt = env.DB.prepare(query);
    if (binds.length) stmt = stmt.bind(...binds);
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
    console.error(error);
    return json({ error: "Unable to load subscribers." }, 500);
  }
}
