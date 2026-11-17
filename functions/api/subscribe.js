
const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

function json(data, status = 200) {
  return Response.json(data, {
    status,
    headers: {
      "Cache-Control": "no-store",
      "X-Content-Type-Options": "nosniff"
    }
  });
}

export async function onRequestPost(context) {
  const { request, env } = context;

  try {
    if (!env.DB) {
      return json({
        error: "Subscriber database is not configured."
      }, 503);
    }

    if (!env.TURNSTILE_SECRET_KEY) {
      console.error("Missing TURNSTILE_SECRET_KEY");
      return json({
        error: "Security verification is unavailable."
      }, 503);
    }

    const contentType =
      request.headers.get("content-type") || "";

    if (!contentType.includes("application/json")) {
      return json({ error: "Invalid request." }, 415);
    }

    const body = await request.json();

    const email = String(body.email || "")
      .trim()
      .toLowerCase();

    const source = String(body.source || "website")
      .slice(0, 100);

    const token = String(body.turnstileToken || "");

    if (
      !email ||
      email.length > 254 ||
      !EMAIL_RE.test(email)
    ) {
      return json({
        error: "Please enter a valid email address."
      }, 400);
    }

    if (!token || token.length > 2048) {
      return json({
        error: "Please complete the security verification."
      }, 400);
    }

    const ip =
      request.headers.get("CF-Connecting-IP") || "";

    // Preserve the existing signup rate limit.
    if (ip) {
      const recent = await env.DB.prepare(
        `SELECT COUNT(*) AS total
         FROM signup_attempts
         WHERE ip = ?
         AND created_at > datetime('now','-1 hour')`
      ).bind(ip).first();

      if ((recent?.total || 0) >= 8) {
        return json({
          error: "Too many signup attempts. Please try again later."
        }, 429);
      }

      await env.DB.prepare(
        `INSERT INTO signup_attempts
         (ip, created_at)
         VALUES (?, datetime('now'))`
      ).bind(ip).run();
    }

    // Verify Cloudflare Turnstile.
    const form = new FormData();
    form.append("secret", env.TURNSTILE_SECRET_KEY);
    form.append("response", token);

    if (ip) {
      form.append("remoteip", ip);
    }

    let verification;

    try {
      const result = await fetch(
        "https://challenges.cloudflare.com/turnstile/v0/siteverify",
        {
          method: "POST",
          body: form,
          signal: AbortSignal.timeout(10000)
        }
      );

      if (!result.ok) {
        throw new Error("Turnstile service error");
      }

      verification = await result.json();

    } catch (error) {
      console.error("Turnstile verification unavailable", error);

      return json({
        error: "Security verification is temporarily unavailable."
      }, 503);
    }

    if (!verification.success) {
      return json({
        error: "Security verification failed. Please try again."
      }, 403);
    }

    const allowedHostnames = [
      "elbigsolis.com",
      "www.elbigsolis.com"
    ];

    if (!allowedHostnames.includes(verification.hostname)) {
      return json({
        error: "Security verification failed."
      }, 403);
    }

    // Check for an existing subscriber.
    const existing = await env.DB.prepare(
      "SELECT id FROM subscribers WHERE email = ? LIMIT 1"
    ).bind(email).first();

    if (existing) {
      return json({
        ok: true,
        duplicate: true,
        message: "You're already on the list. Welcome back."
      });
    }

    // Save subscriber and activity together.
    // A transaction-style batch prevents a successful signup
    // from being recorded without its activity entry.
    await env.DB.batch([
      env.DB.prepare(
        `INSERT INTO subscribers
         (email, source, status, created_at, consent_at)
         VALUES (?, ?, 'subscribed',
         datetime('now'), datetime('now'))`
      ).bind(email, source),

      env.DB.prepare(
        `INSERT INTO subscriber_activity
         (subscriber_id, email, action, created_at)
         VALUES (
           (SELECT id FROM subscribers WHERE email = ? LIMIT 1),
           ?,
           'subscribed',
           CURRENT_TIMESTAMP
         )`
      ).bind(email, email)
    ]);

    return json({
      ok: true,
      message: "You're in. Welcome to La Familia."
    }, 201);

  } catch (error) {
    console.error("Signup error:", error);

    return json({
      error: "Unable to join right now. Please try again."
    }, 500);
  }
}

export function onRequestGet() {
  return json({ error: "Method not allowed." }, 405);
}
