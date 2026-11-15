export async function onRequestPost({request,env}){
 if(!env.DB||!env.STRIPE_SECRET_KEY)return Response.json({error:'Stripe not configured'},{status:503});
 let v;try{v=await request.json()}catch{return Response.json({error:'Invalid JSON'},{status:400})}
 const id=v?.id,amount=v?.amount_cents;
 if(!Number.isSafeInteger(id)||id<1||!Number.isSafeInteger(amount)||amount<100||amount>100000)return Response.json({error:'Downloads require a minimum payment of $1 (maximum $1,000).'},{status:400});
 const row=await env.DB.prepare(`SELECT u.title,s.price_min_cents FROM studio_uploads u JOIN studio_store s ON u.id=s.upload_id WHERE u.id=? AND s.published=1`).bind(id).first();
 if(!row||amount<Math.max(100,row.price_min_cents))return Response.json({error:'Track unavailable or below minimum price'},{status:400});
 const origin=new URL(request.url).origin;
 const form=new URLSearchParams({'mode':'payment','success_url':`${origin}/music/?session_id={CHECKOUT_SESSION_ID}`,'cancel_url':`${origin}/music/`,'line_items[0][price_data][currency]':'usd','line_items[0][price_data][unit_amount]':String(amount),'line_items[0][price_data][product_data][name]':row.title,'line_items[0][quantity]':'1','metadata[track_id]':String(id),'client_reference_id':'big-solis-studio-v1'});
 const res=await fetch('https://api.stripe.com/v1/checkout/sessions',{method:'POST',headers:{Authorization:`Bearer ${env.STRIPE_SECRET_KEY}`,'Content-Type':'application/x-www-form-urlencoded'},body:form});
 const data=await res.json();if(!res.ok)return Response.json({error:'Checkout unavailable'},{status:502});
 return Response.json({url:data.url});
}
