const auth=(request,env)=>Boolean(env.ADMIN_TOKEN&&request.headers.get('authorization')===`Bearer ${env.ADMIN_TOKEN}`);
export async function onRequest({request,env}){
 if(!auth(request,env))return Response.json({error:'Unauthorized'},{status:401});
 if(!env.DB)return Response.json({error:'No DB'},{status:503});
 if(request.method==='GET'){
  const r=await env.DB.prepare(`SELECT u.id,u.title,u.filename,COALESCE(s.published,0) published,COALESCE(s.price_min_cents,0) price_min_cents,COALESCE(s.description,'') description FROM studio_uploads u LEFT JOIN studio_store s ON s.upload_id=u.id ORDER BY u.id DESC`).all();
  return Response.json({tracks:r.results||[]});
 }
 if(request.method==='POST'){
  let v;try{v=await request.json()}catch{return Response.json({error:'Invalid JSON'},{status:400})}
  if(!Number.isSafeInteger(v.id)||v.id<1||typeof v.published!=='boolean'||!Number.isSafeInteger(v.price_min_cents)||v.price_min_cents<100||v.price_min_cents>100000||typeof v.description!=='string'||v.description.length>500)return Response.json({error:'Invalid fields'},{status:400});
  const r=await env.DB.prepare(`INSERT INTO studio_store(upload_id,published,price_min_cents,description) SELECT id,?,?,? FROM studio_uploads WHERE id=? ON CONFLICT(upload_id) DO UPDATE SET published=excluded.published,price_min_cents=excluded.price_min_cents,description=excluded.description`).bind(v.published?1:0,v.price_min_cents,v.description,v.id).run();
  return Response.json({ok:!!r.meta.changes});
 }
 return new Response('Method not allowed',{status:405});
}
