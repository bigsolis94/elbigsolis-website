export async function onRequestGet({request,env}){
 const session=new URL(request.url).searchParams.get('session_id');
 if(!session||!/^cs_(test_|live_)[A-Za-z0-9]+$/.test(session)||!env.STRIPE_SECRET_KEY)return new Response('Invalid session',{status:400});
 const r=await fetch(`https://api.stripe.com/v1/checkout/sessions/${encodeURIComponent(session)}`,{headers:{Authorization:`Bearer ${env.STRIPE_SECRET_KEY}`}});
 if(!r.ok)return new Response('Invalid session',{status:400});const s=await r.json();
 if(s.payment_status!=='paid'||!Number.isSafeInteger(Number(s.metadata?.track_id)))return new Response('Not paid',{status:403});
 return Response.json({id:Number(s.metadata.track_id)},{headers:{'Cache-Control':'no-store'}});
}
