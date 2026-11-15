import {makeGrant} from './grant.js';
export async function onRequestGet({request,env}){
 const session=new URL(request.url).searchParams.get('session_id');
 if(!session||!/^cs_(test_|live_)[A-Za-z0-9]+$/.test(session)||!env.STRIPE_SECRET_KEY||!env.DB)return new Response('Invalid session',{status:400});
 const r=await fetch(`https://api.stripe.com/v1/checkout/sessions/${encodeURIComponent(session)}`,{headers:{Authorization:`Bearer ${env.STRIPE_SECRET_KEY}`}});
 if(!r.ok)return new Response('Invalid session',{status:400});
 const s=await r.json(),id=Number(s.metadata?.track_id);
 if(s.payment_status!=='paid'||s.mode!=='payment'||s.currency!=='usd'||!Number.isSafeInteger(id)||id<1||s.client_reference_id!=='big-solis-studio-v1')return new Response('Payment not verified',{status:403});
 const row=await env.DB.prepare('SELECT price_min_cents FROM studio_store WHERE upload_id=? AND published=1').bind(id).first();
 if(!row||!Number.isSafeInteger(s.amount_total)||s.amount_total<Math.max(100,row.price_min_cents))return new Response('Payment not verified',{status:403});
 const grant=await makeGrant(env.STRIPE_SECRET_KEY,id,session);
 return Response.json({id,grant,expires_in_seconds:900},{headers:{'Cache-Control':'no-store','Referrer-Policy':'no-referrer'}});
}
