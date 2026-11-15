
export async function onRequestPost({request,env}) {
  if (!env.DB) {
    return Response.json({error:'Database unavailable'},{status:503});
  }

  let data;
  try {
    data = await request.json();
  } catch {
    return Response.json({error:'Invalid request'},{status:400});
  }

  const id = data?.id;

  if (!Number.isSafeInteger(id) || id < 1) {
    return Response.json({error:'Invalid track'},{status:400});
  }

  const track = await env.DB.prepare(
    `SELECT u.id FROM studio_uploads u
     JOIN studio_store s ON s.upload_id=u.id
     WHERE u.id=? AND s.published=1`
  ).bind(id).first();

  if (!track) {
    return Response.json({error:'Track unavailable'},{status:404});
  }

  await env.DB.prepare(
    `INSERT INTO studio_events (upload_id,event_type)
     VALUES (?,'play')`
  ).bind(id).run();

  return Response.json({success:true});
}
