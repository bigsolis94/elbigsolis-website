
const json = (body, status = 200) =>
  Response.json(body, {
    status,
    headers: {
      'Cache-Control': 'no-store',
      'X-Content-Type-Options': 'nosniff'
    }
  });

export async function onRequestGet({ env }) {
  if (!env.DB) {
    return json(
      { error: 'Database unavailable' },
      503
    );
  }

  try {
    const result = await env.DB.prepare(`
      SELECT
        id,
        title,
        artist,
        release_type,
        description,
        cover_key,
        price_min_cents
      FROM studio_albums
      WHERE published = 1
      ORDER BY id DESC
      LIMIT 100
    `).all();

    const albums = result.results || [];

    for (const album of albums) {
      const tracks = await env.DB.prepare(`
        SELECT
          u.id,
          u.title,
          at.track_number
        FROM studio_album_tracks at
        JOIN studio_uploads u
          ON u.id = at.upload_id
        WHERE at.album_id = ?
        ORDER BY at.track_number
      `).bind(album.id).all();

      album.tracks = tracks.results || [];

      album.cover_url = album.cover_key
        ? '/api/studio/album-cover?id=' +
          encodeURIComponent(album.id)
        : null;

      delete album.cover_key;
    }

    return json({ albums });

  } catch (e) {
    console.error(
      'Public album catalog error',
      e
    );

    return json(
      { error: 'Album catalog unavailable' },
      500
    );
  }
}
