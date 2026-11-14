
const reply=(data,status=200)=>Response.json(data,{status,headers:{'Cache-Control':'no-store','X-Content-Type-Options':'nosniff'}});
const MAX=45*1024*1024;
const authorized=(request,env)=>Boolean(env.ADMIN_TOKEN&&request.headers.get('authorization')===`Bearer ${env.ADMIN_TOKEN}`);
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
   const length=Number(request.headers.get('content-length'));
   if(!title||title.length>180||!filename||filename.length>255)return reply({error:'Enter a title and filename'},400);
   if(!/\.(mp3|wav)$/i.test(filename))return reply({error:'Only MP3 and WAV files are supported'},415);
   if(!Number.isSafeInteger(length)||length<128||length>MAX)return reply({error:'File must be between 128 bytes and 45 MB'},413);
   const buffer=await request.arrayBuffer(),b=new Uint8Array(buffer);
   if(b.length!==length||b.length>MAX)return reply({error:'Invalid file size'},400);
   const wav=b.length>12&&String.fromCharCode(...b.slice(0,4))==='RIFF'&&String.fromCharCode(...b.slice(8,12))==='WAVE';
   const mp3=(b[0]===73&&b[1]===68&&b[2]===51)||(b[0]===255&&(b[1]&224)===224);
   if(!(wav||mp3))return reply({error:'The file does not appear to be MP3 or WAV'},415);
   if((wav&&!/\.wav$/i.test(filename))||(mp3&&!/\.mp3$/i.test(filename)))return reply({error:'File extension does not match audio format'},415);
   const contentType=wav?'audio/wav':'audio/mpeg';
   const key='private-tracks/'+crypto.randomUUID()+(wav?'.wav':'.mp3');
   await env.MUSIC_BUCKET.put(key,buffer,{httpMetadata:{contentType}});
   try{
    const result=await env.DB.prepare('INSERT INTO studio_uploads(title,filename,object_key,content_type,byte_size) VALUES(?,?,?,?,?)').bind(title,filename,key,contentType,b.length).run();
    return reply({ok:true,id:result.meta.last_row_id},201);
   }catch(err){await env.MUSIC_BUCKET.delete(key);throw err}
  }
  if(request.method==='DELETE'){
   const body=await request.json();
   if(!Number.isSafeInteger(body.id)||body.id<1)return reply({error:'Invalid track ID'},400);
   const record=await env.DB.prepare('SELECT object_key FROM studio_uploads WHERE id=?').bind(body.id).first();
   if(!record)return reply({error:'Track not found'},404);
   await env.MUSIC_BUCKET.delete(record.object_key);
   await env.DB.prepare('DELETE FROM studio_uploads WHERE id=?').bind(body.id).run();
   return reply({ok:true});
  }
  return reply({error:'Method not allowed'},405);
 }catch(err){console.error('uploads',err);return reply({error:'Upload failed. Check the database table and R2 binding.'},500)}
}
