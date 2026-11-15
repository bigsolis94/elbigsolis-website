export async function onRequestGet({request,env}){
 if(!env.DB||!env.MUSIC_BUCKET)return new Response('Unavailable',{status:503});
 const id=Number(new URL(request.url).searchParams.get('id'));
 if(!Number.isSafeInteger(id)||id<1)return new Response('Invalid ID',{status:400});
 const row=await env.DB.prepare(`SELECT u.object_key,u.content_type,u.byte_size FROM studio_uploads u JOIN studio_store s ON s.upload_id=u.id WHERE u.id=? AND s.published=1`).bind(id).first();
 if(!row)return new Response('Not found',{status:404});
 const range=request.headers.get('Range');let start=0,end=row.byte_size-1,partial=false;
 if(range){const m=/^bytes=(\d*)-(\d*)$/.exec(range);if(!m||(!m[1]&&!m[2]))return new Response('Invalid range',{status:416});
  if(!m[1]){const suffix=Number(m[2]);if(!Number.isSafeInteger(suffix)||suffix<1)return new Response('Invalid range',{status:416});start=Math.max(0,row.byte_size-suffix)}
  else{start=Number(m[1]);end=m[2]?Number(m[2]):end;}
  if(!Number.isSafeInteger(start)||!Number.isSafeInteger(end)||start>=row.byte_size||end<start)return new Response('Invalid range',{status:416});
  end=Math.min(end,row.byte_size-1);partial=true;
 }
 const obj=await env.MUSIC_BUCKET.get(row.object_key,partial?{range:{offset:start,length:end-start+1}}:{});
 if(!obj)return new Response('Not found',{status:404});
 const h={'Content-Type':row.content_type,'Accept-Ranges':'bytes','Content-Length':String(end-start+1),'Cache-Control':'no-store','X-Content-Type-Options':'nosniff'};
 if(partial)h['Content-Range']=`bytes ${start}-${end}/${row.byte_size}`;
 return new Response(obj.body,{status:partial?206:200,headers:h});
}
