const reply=(data,status=200)=>Response.json(data,{status,headers:{'Cache-Control':'no-store','X-Content-Type-Options':'nosniff'}});
const MAX=45*1024*1024;
const authorized=(request,env)=>Boolean(env.ADMIN_TOKEN&&request.headers.get('authorization')===`Bearer ${env.ADMIN_TOKEN}`);
function audioInfo(filename,buffer){
 const b=new Uint8Array(buffer);
 const wav=b.length>12&&String.fromCharCode(...b.slice(0,4))==='RIFF'&&String.fromCharCode(...b.slice(8,12))==='WAVE';
 const mp3=(b[0]===73&&b[1]===68&&b[2]===51)||(b[0]===255&&(b[1]&224)===224);
 if(!(wav||mp3))throw Object.assign(new Error('The file does not appear to be MP3 or WAV'),{status:415});
 if((wav&&!/\.wav$/i.test(filename))||(mp3&&!/\.mp3$/i.test(filename)))throw Object.assign(new Error('File extension does not match audio format'),{status:415});
 return {contentType:wav?'audio/wav':'audio/mpeg',extension:wav?'.wav':'.mp3',size:b.length};
}
async function readAudio(request,filename){
 const length=Number(request.headers.get('content-length'));
 if(!filename||filename.length>255||!/\.(mp3|wav)$/i.test(filename))throw Object.assign(new Error('Only MP3 and WAV files are supported'),{status:415});
 if(!Number.isSafeInteger(length)||length<128||length>MAX)throw Object.assign(new Error('File must be between 128 bytes and 45 MB'),{status:413});
 const buffer=await request.arrayBuffer();
 if(buffer.byteLength!==length)throw Object.assign(new Error('Invalid file size'),{status:400});
 return {buffer,...audioInfo(filename,buffer)};
}
export async function onRequest({request,env}){
 if(!authorized(request,env))return reply({error:'Unauthorized'},401);
 if(!env.DB||!env.MUSIC_BUCKET)return reply({error:'Missing DB or MUSIC_BUCKET binding'},503);
 try{
  if(request.method==='GET'){
   const q=await env.DB.prepare('SELECT id,title,filename,content_type,byte_size,created_at FROM studio_uploads ORDER BY id DESC LIMIT 100').all();
   return reply({uploads:q.results||[]});
  }
  if(request.method==='POST'){
   const u=new URL(request.url),title=(u.searchParams.get('title')||'').trim(),filename=(u.searchParams.get('filename')||'').trim();
   if(!title||title.length>180)return reply({error:'Enter a title (maximum 180 characters)'},400);
   const audio=await readAudio(request,filename);
   const key='private-tracks/'+crypto.randomUUID()+audio.extension;
   await env.MUSIC_BUCKET.put(key,audio.buffer,{httpMetadata:{contentType:audio.contentType}});
   try{
    const result=await env.DB.prepare('INSERT INTO studio_uploads(title,filename,object_key,content_type,byte_size) VALUES(?,?,?,?,?)').bind(title,filename,key,audio.contentType,audio.size).run();
    return reply({ok:true,id:result.meta.last_row_id},201);
   }catch(err){await env.MUSIC_BUCKET.delete(key).catch(()=>{});throw err}
  }
  if(request.method==='PATCH'){
   const body=await request.json().catch(()=>null);
   if(!body||!Number.isSafeInteger(body.id)||body.id<1||typeof body.title!=='string'||!body.title.trim()||body.title.trim().length>180)return reply({error:'Valid track ID and title required'},400);
   const result=await env.DB.prepare('UPDATE studio_uploads SET title=? WHERE id=?').bind(body.title.trim(),body.id).run();
   if(!result.meta.changes)return reply({error:'Track not found'},404);
   return reply({ok:true});
  }
  if(request.method==='PUT'){
   const u=new URL(request.url),id=Number(u.searchParams.get('id')),filename=(u.searchParams.get('filename')||'').trim();
   if(!Number.isSafeInteger(id)||id<1)return reply({error:'Invalid track ID'},400);
   const old=await env.DB.prepare('SELECT object_key FROM studio_uploads WHERE id=?').bind(id).first();
   if(!old)return reply({error:'Track not found'},404);
   const audio=await readAudio(request,filename);
   const key='private-tracks/'+crypto.randomUUID()+audio.extension;
   await env.MUSIC_BUCKET.put(key,audio.buffer,{httpMetadata:{contentType:audio.contentType}});
   try{
    const result=await env.DB.prepare('UPDATE studio_uploads SET filename=?,object_key=?,content_type=?,byte_size=? WHERE id=? AND object_key=?').bind(filename,key,audio.contentType,audio.size,id,old.object_key).run();
    if(!result.meta.changes){await env.MUSIC_BUCKET.delete(key).catch(()=>{});return reply({error:'Track changed during replacement. Refresh and retry.'},409)}
   }catch(err){await env.MUSIC_BUCKET.delete(key).catch(()=>{});throw err}
   // Old audio is removed only after the database points to the new object.
   try{await env.MUSIC_BUCKET.delete(old.object_key)}catch(err){console.error('Old audio cleanup failed',err)}
   return reply({ok:true,id});
  }
  if(request.method==='DELETE'){
   const body=await request.json().catch(()=>null);
   if(!body||!Number.isSafeInteger(body.id)||body.id<1)return reply({error:'Invalid track ID'},400);
   const record=await env.DB.prepare('SELECT object_key FROM studio_uploads WHERE id=?').bind(body.id).first();
   if(!record)return reply({error:'Track not found'},404);
   // Database delete first: a failure must not leave a live row pointing at deleted audio.
   await env.DB.prepare('DELETE FROM studio_uploads WHERE id=?').bind(body.id).run();
   try{await env.MUSIC_BUCKET.delete(record.object_key)}catch(err){console.error('Deleted track object cleanup failed',err)}
   return reply({ok:true});
  }
  return reply({error:'Method not allowed'},405);
 }catch(err){console.error('uploads',err);return reply({error:err.status?err.message:'Request failed. Check the database and R2 bindings.'},err.status||500)}
}
