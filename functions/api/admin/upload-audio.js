
export async function onRequest({request,env}){
 if(!env.ADMIN_TOKEN||request.headers.get('authorization')!==`Bearer ${env.ADMIN_TOKEN}`)return new Response('Unauthorized',{status:401});
 if(request.method!=='GET')return new Response('Method not allowed',{status:405});
 if(!env.DB||!env.MUSIC_BUCKET)return new Response('Storage unavailable',{status:503});
 const id=Number(new URL(request.url).searchParams.get('id'));
 if(!Number.isSafeInteger(id)||id<1)return new Response('Invalid ID',{status:400});
 const row=await env.DB.prepare('SELECT object_key,content_type FROM studio_uploads WHERE id=?').bind(id).first();
 if(!row)return new Response('Not found',{status:404});
 const obj=await env.MUSIC_BUCKET.get(row.object_key);
 if(!obj)return new Response('Not found',{status:404});
 return new Response(obj.body,{headers:{'Content-Type':row.content_type,'Cache-Control':'private, no-store','X-Content-Type-Options':'nosniff'}});
}
