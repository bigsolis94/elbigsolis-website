function unauthorized() {
  return new Response("Unauthorized", { status: 401 });
}

export async function onRequestGet(context) {
  if (!context.env.DB || !context.env.ADMIN_TOKEN) {
    return new Response("Not configured", { status: 500 });
  }

  const supplied = context.request.headers.get("authorization") || "";
  if (supplied !== `Bearer ${context.env.ADMIN_TOKEN}`) {
    return unauthorized();
  }

  const { results } = await context.env.DB.prepare(
    `SELECT email, source, status, created_at, consent_at
     FROM subscribers
     ORDER BY created_at DESC`
  ).all();

  const esc = (v) => `"${String(v ?? "").replaceAll('"','""')}"`;
  const rows = [
    ["email","source","status","created_at","consent_at"],
    ...results.map(r => [r.email,r.source,r.status,r.created_at,r.consent_at])
  ];

  return new Response(rows.map(row => row.map(esc).join(",")).join("\n"), {
    headers: {
      "content-type": "text/csv; charset=UTF-8",
      "content-disposition": 'attachment; filename="big-solis-fan-list.csv"',
      "cache-control": "no-store"
    }
  });
}
