export async function onRequestGet({env}) {
 if (!env.DB) return Response.json({error:'Database unavailable'}, {status:503});
 try {
  const result = await env.DB.prepare(`SELECT id,title,artist,cover_url,release_at,presave_url,spotify_url,apple_url,youtube_url,preview_url,featured FROM music_releases WHERE published=1 ORDER BY release_at DESC LIMIT 100`).all();
  return Response.json({releases:result.results||[]}, {headers:{'Cache-Control':'public, max-age=60'}});
 } catch(e) { console.error(e); return Response.json({error:'Releases unavailable'}, {status:503}); }
}
