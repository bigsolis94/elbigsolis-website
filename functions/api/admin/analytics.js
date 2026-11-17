const reply=(data,status=200)=>Response.json(data,{status,headers:{'Cache-Control':'private, no-store','X-Content-Type-Options':'nosniff'}});
export async function onRequestGet({request,env}){
 if(!env.ADMIN_TOKEN||request.headers.get('authorization')!==`Bearer ${env.ADMIN_TOKEN}`)return reply({error:'Unauthorized'},401);
 if(!env.DB)return reply({error:'Missing database binding'},503);
 try{
  const [totals,tracks,daily]=await Promise.all([
   env.DB.prepare("SELECT COALESCE(SUM(CASE WHEN event_type='play' THEN 1 ELSE 0 END),0) AS plays, COALESCE(SUM(CASE WHEN event_type='download' THEN 1 ELSE 0 END),0) AS downloads FROM studio_events").first(),
   env.DB.prepare("SELECT u.id,u.title,COALESCE(SUM(CASE WHEN e.event_type='play' THEN 1 ELSE 0 END),0) AS plays,COALESCE(SUM(CASE WHEN e.event_type='download' THEN 1 ELSE 0 END),0) AS downloads FROM studio_uploads u LEFT JOIN studio_events e ON e.upload_id=u.id GROUP BY u.id,u.title ORDER BY plays DESC,downloads DESC,u.id DESC LIMIT 100").all(),
   env.DB.prepare("SELECT substr(created_at,1,10) AS day, SUM(CASE WHEN event_type='play' THEN 1 ELSE 0 END) AS plays, SUM(CASE WHEN event_type='download' THEN 1 ELSE 0 END) AS downloads FROM studio_events WHERE created_at>=datetime('now','-29 days') GROUP BY substr(created_at,1,10) ORDER BY day ASC").all()
  ]);
  return reply({totals:{plays:totals?.plays||0,downloads:totals?.downloads||0},tracks:tracks.results||[],daily:daily.results||[]});
 }catch(err){console.error('analytics',err);return reply({error:'Could not load music analytics. Verify studio_events table.'},500)}
}
