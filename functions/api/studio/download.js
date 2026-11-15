export async function onRequestGet({request,env}){
 if(!env.DB||!env.MUSIC_BUCKET)return new Response('Unavailable',{status:503});
 const u=new URL(request.url),id=Number(u.searchParams.get('id')),session=u.searchParams.get('session_id');
 if(!Number.isSafeInteger(id)||id<1)return new Response('Invalid ID',{status:400});
 const row=await env.DB.prepare(`SELECT u.filename,u.object_key,u.content_type,s.price_min_cents FROM studio_uploads u JOIN studio_store s ON u.id=s.upload_id WHERE u.id=? AND s.published=1`).bind(id).first();
 if(!row)return new Response('Not found',{status:404});
 {
  if(!session||!/^cs_(test_|live_)[A-Za-z0-9]+$/.test(session)||!env.STRIPE_SECRET_KEY)return new Response('Payment required',{status:402});
  const res=await fetch(`https://api.stripe.com/v1/checkout/sessions/${encodeURIComponent(session)}`,{headers:{Authorization:`Bearer ${env.STRIPE_SECRET_KEY}`}});
  if(!res.ok)return new Response('Payment verification failed',{status:403});
  const s=await res.json();
  if(s.payment_status!=='paid'||s.mode!=='payment'||s.metadata?.track_id!==String(id)||s.amount_total<Math.max(100,row.price_min_cents)||s.currency!=='usd')return new Response('Payment not verified',{status:403});
 }
 const obj=await env.MUSIC_BUCKET.get(row.object_key);if(!obj)return new Response('Not found',{status:404});
 const filename=row.filename.replace(/[\"\\\r\n]/g,'_');
 return new Response(obj.body,{headers:{'Content-Type':row.content_type,'Content-Disposition':`attachment; filename="${filename}"`,'Cache-Control':'private, no-store','X-Content-Type-Options':'nosniff'}});
}
