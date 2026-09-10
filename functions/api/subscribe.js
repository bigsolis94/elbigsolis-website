const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

function json(data, status = 200) {
  return new Response(JSON.stringify(data), {
    status,
    headers: {
      "content-type": "application/json; charset=UTF-8",
      "cache-control": "no-store"
    }
  });
}

export async function onRequestPost(context) {
  try {
    if (!context.env.DB) {
      return json({ error: "Subscriber database is not configured yet." }, 500);
    }

    const contentType = context.request.headers.get("content-type") || "";
    if (!contentType.includes("application/json")) {
      return json({ error: "Invalid request." }, 415);
    }

    const body = await context.request.json();
    const email = String(body.email || "").trim().toLowerCase();
    const source = String(body.source || "website").slice(0, 100);

    if (!email || email.length > 254 || !EMAIL_RE.test(email)) {
      return json({ error: "Please enter a valid email address." }, 400);
    }

    const ip =
      context.request.headers.get("CF-Connecting-IP") ||
      context.request.headers.get("x-forwarded-for") ||
      "";

    // Basic abuse control: max 8 successful/attempted signups from the same IP per hour.
    if (ip) {
      const recent = await context.env.DB.prepare(
        `SELECT COUNT(*) AS total
         FROM signup_attempts
         WHERE ip = ? AND created_at > datetime('now','-1 hour')`
      ).bind(ip).first();

      if ((recent?.total || 0) >= 8) {
        return json({ error: "Too many signup attempts. Please try again later." }, 429);
      }

      await context.env.DB.prepare(
        `INSERT INTO signup_attempts (ip, created_at) VALUES (?, datetime('now'))`
      ).bind(ip).run();
    }

    const existing = await context.env.DB.prepare(
      "SELECT id FROM subscribers WHERE email = ? LIMIT 1"
    ).bind(email).first();

    if (existing) {
      return json({
        ok: true,
        duplicate: true,
        message: "You’re already on the list. Welcome back."
      });
    }

    await context.env.DB.prepare(
      `INSERT INTO subscribers
       (email, source, status, created_at, consent_at)
       VALUES (?, ?, 'subscribed', datetime('now'), datetime('now'))`
    ).bind(email, source).run();

    return json({
      ok: true,
      message: "You’re in. Welcome to La Familia."
    }, 201);

  } catch (error) {
    console.error(error);
    return json({ error: "Unable to join right now. Please try again." }, 500);
  }
}

export function onRequestGet() {
  return json({ error: "Method not allowed." }, 405);
}
