import {verifyGrant} from './grant.js';
export async function onRequestGet({request,env}){
 if(!env.DB||!env.MUSIC_BUCKET||!env.STRIPE_SECRET_KEY)return new Response('Unavailable',{status:503});
 const u=new URL(request.url),id=Number(u.searchParams.get('id')),grant=u.searchParams.get('grant');
 if(!Number.isSafeInteger(id)||id<1)return new Response('Invalid ID',{status:400});
 const verified=await verifyGrant(env.STRIPE_SECRET_KEY,grant,id);
 if(!verified)return new Response('Download link invalid or expired. Return to your receipt to request a new link.',{status:403});
 const row=await env.DB.prepare('SELECT u.filename,u.object_key,u.content_type,s.price_min_cents FROM studio_uploads u JOIN studio_store s ON u.id=s.upload_id WHERE u.id=? AND s.published=1').bind(id).first();
 if(!row)return new Response('Not found',{status:404});
 // Re-check Stripe at download time: grants cannot override refunds or mismatched purchases.
 const res=await fetch(`https://api.stripe.com/v1/checkout/sessions/${encodeURIComponent(verified.session)}`,{headers:{Authorization:`Bearer ${env.STRIPE_SECRET_KEY}`}});
 if(!res.ok)return new Response('Payment verification failed',{status:403});
 const s=await res.json();
 if(s.payment_status!=='paid'||s.mode!=='payment'||s.client_reference_id!=='big-solis-studio-v1'||s.metadata?.track_id!==String(id)||!Number.isSafeInteger(s.amount_total)||s.amount_total<Math.max(100,row.price_min_cents)||s.currency!=='usd')return new Response('Payment not verified',{status:403});
 const obj=await env.MUSIC_BUCKET.get(row.object_key);if(!obj)return new Response('Not found',{status:404});
 const filename=row.filename.replace(/["\\\r\n]/g,'_');
 return new Response(obj.body,{headers:{'Content-Type':row.content_type,'Content-Disposition':`attachment; filename="${filename}"`,'Cache-Control':'private, no-store','Referrer-Policy':'no-referrer','X-Content-Type-Options':'nosniff'}});
}
