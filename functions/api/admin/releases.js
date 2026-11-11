const reply=(data,status=200)=>Response.json(data,{status,headers:{'Cache-Control':'no-store'}});
const authorized=({request,env})=>Boolean(env.ADMIN_TOKEN && request.headers.get('authorization')===`Bearer ${env.ADMIN_TOKEN}`);
const keys=['title','artist','cover_url','release_at','presave_url','spotify_url','apple_url','youtube_url','preview_url'];
function validate(v){
 if(!v||typeof v!=='object'||Array.isArray(v))throw Error('Invalid release');
 const r={};
 for(const k of keys){if(typeof v[k]!=='string')throw Error('Invalid '+k);r[k]=v[k].trim();if(r[k].length>1000)throw Error(k+' too long');}
 if(!r.title||r.title.length>180||!r.artist||r.artist.length>180)throw Error('Title and artist are required');
 if(!/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(?:\.\d{1,3})?(?:Z|[+-]\d{2}:\d{2})$/.test(r.release_at)||!Number.isFinite(Date.parse(r.release_at)))throw Error('Release date must include a timezone');
 for(const k of keys.filter(k=>k.endsWith('_url'))){if(r[k]){let u;try{u=new URL(r[k]);}catch{throw Error('Invalid '+k)}if(u.protocol!=='https:')throw Error('Only HTTPS URLs are allowed');}}
 r.featured=v.featured===true?1:0;r.published=v.published===false?0:1;
 return r;
}
export async function onRequest({request,env}){
 if(!authorized({request,env}))return reply({error:'Unauthorized'},401);
 if(!env.DB)return reply({error:'Database unavailable'},503);
 try{
  if(request.method==='GET'){
   const res=await env.DB.prepare('SELECT * FROM music_releases ORDER BY release_at DESC LIMIT 200').all();return reply({releases:res.results||[]});
  }
  if(request.method==='POST'||request.method==='PUT'){
   const v=await request.json();const r=validate(v);
   if(request.method==='PUT'&&(!Number.isSafeInteger(v.id)||v.id<1))return reply({error:'Invalid ID'},400);
   const values=[...keys.map(k=>r[k]),r.featured,r.published];
   if(request.method==='POST'){
    const q=`INSERT INTO music_releases (${keys.join(',')},featured,published) VALUES (${values.map(()=>'?').join(',')})`;
    const result=await env.DB.prepare(q).bind(...values).run();return reply({ok:true,id:result.meta.last_row_id},201);
   }
   const q=`UPDATE music_releases SET ${[...keys,'featured','published'].map(k=>k+'=?').join(',')},updated_at=CURRENT_TIMESTAMP WHERE id=?`;
   const result=await env.DB.prepare(q).bind(...values,v.id).run();return result.meta.changes?reply({ok:true}):reply({error:'Not found'},404);
  }
  if(request.method==='DELETE'){
   const v=await request.json();if(!Number.isSafeInteger(v.id)||v.id<1)return reply({error:'Invalid ID'},400);
   const result=await env.DB.prepare('DELETE FROM music_releases WHERE id=?').bind(v.id).run();return result.meta.changes?reply({ok:true}):reply({error:'Not found'},404);
  }
  return reply({error:'Method not allowed'},405);
 }catch(e){console.error(e);return reply({error:e instanceof SyntaxError?'Invalid JSON':e.message?.startsWith('D1_')?'Database error':e.message||'Request failed'},e instanceof SyntaxError?400: /Invalid|required|too long|HTTPS|timezone/.test(e.message||'')?400:500);}
}
