export async function onRequestGet({env}){
 if(!env.DB)return Response.json({error:'Unavailable'},{status:503});
 const r=await env.DB.prepare(`SELECT u.id,u.title,u.content_type,u.byte_size,s.description,MAX(s.price_min_cents,100) AS price_min_cents FROM studio_uploads u JOIN studio_store s ON s.upload_id=u.id WHERE s.published=1 ORDER BY u.id DESC LIMIT 100`).all();
 return Response.json({tracks:r.results||[]},{headers:{'Cache-Control':'public, max-age=60'}});
}
