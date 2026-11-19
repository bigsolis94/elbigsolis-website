
// BIG SOLIS STUDIO — private Album & EP Manager
// Save as functions/api/admin/albums.js
// Requires D1 binding DB and encrypted ADMIN_TOKEN.

const json = (data, status = 200) => Response.json(data, {
  status,
  headers: { 'Cache-Control': 'no-store', 'X-Content-Type-Options': 'nosniff' }
});

async function authorized(request, env) {
  const expected = env.ADMIN_TOKEN;
  const supplied = request.headers.get('Authorization') || '';
  if (!expected || !supplied.startsWith('Bearer ')) return false;
  const a = new TextEncoder().encode(supplied.slice(7));
  const b = new TextEncoder().encode(expected);
  if (a.length !== b.length) return false;
  let diff = 0;
  for (let i = 0; i < a.length; i++) diff |= a[i] ^ b[i];
  return diff === 0;
}

function positiveInt(v) { return Number.isSafeInteger(v) && v > 0; }

function cleanText(v, max, required = false) {
  if (typeof v !== 'string') throw Error('Invalid text field');
  const s = v.trim();
  if (s.length > max || (required && !s)) {
    throw Error('Text field is empty or too long');
  }
  return s;
}

function validate(body, updating = false) {
  if (!body || typeof body !== 'object' || Array.isArray(body)) {
    throw Error('Invalid album data');
  }

  const title = cleanText(body.title, 180, true);
  const artist = cleanText(body.artist ?? 'BIG SOLIS', 180, true);
  const release_type = body.release_type ?? body.releaseType ?? 'album';

  if (!['album', 'ep'].includes(release_type)) {
    throw Error('Choose album or ep');
  }

  const description = cleanText(body.description ?? '', 3000);
  const price_min_cents = Number(
    body.price_min_cents ?? body.priceMinCents ?? 500
  );

  if (
    !Number.isSafeInteger(price_min_cents) ||
    price_min_cents < 100 ||
    price_min_cents > 100000
  ) {
    throw Error('Minimum price must be between $1 and $1,000');
  }

  const published = body.published === true || body.published === 1 ? 1 : 0;

  const cover_key = body.cover_key == null || body.cover_key === ''
    ? null
    : cleanText(body.cover_key, 500);

  const rawTracks = body.track_ids ?? body.trackIds ?? body.tracks ?? [];

  if (!Array.isArray(rawTracks) || rawTracks.length > 100) {
    throw Error('Provide up to 100 tracks');
  }

  const track_ids = rawTracks.map(x =>
    typeof x === 'object' && x !== null
      ? Number(x.upload_id ?? x.id)
      : Number(x)
  );

  if (
    track_ids.some(x => !positiveInt(x)) ||
    new Set(track_ids).size !== track_ids.length
  ) {
    throw Error('Track IDs must be unique positive integers');
  }

  if (published && track_ids.length === 0) {
    throw Error('Add at least one track before publishing');
  }

  const id = Number(body.id);

  if (updating && !positiveInt(id)) {
    throw Error('Invalid album ID');
  }

  return {
    id, title, artist, release_type, description,
    cover_key, price_min_cents, published, track_ids
  };
}

async function checkTracks(env, ids) {
  if (!ids.length) return;

  const marks = ids.map(() => '?').join(',');
  const result = await env.DB.prepare(
    `SELECT id FROM studio_uploads WHERE id IN (${marks})`
  ).bind(...ids).all();

  const found = new Set((result.results || []).map(x => x.id));

  if (ids.some(id => !found.has(id))) {
    throw Error('One or more songs do not exist in Music Uploads');
  }
}

async function handle(request, env, method) {
  if (!env.DB) {
    return json({ error: 'Database unavailable' }, 503);
  }

  if (!(await authorized(request, env))) {
    return json({ error: 'Unauthorized' }, 401);
  }

  try {
    if (method === 'GET') {
      const albums = await env.DB.prepare(`
        SELECT id,title,artist,release_type,description,
               cover_key,price_min_cents,published,created_at
        FROM studio_albums
        ORDER BY id DESC LIMIT 200
      `).all();

      const tracks = await env.DB.prepare(`
        SELECT at.album_id,at.upload_id,at.track_number,u.title,u.filename
        FROM studio_album_tracks at
        JOIN studio_uploads u ON u.id=at.upload_id
        ORDER BY at.album_id,at.track_number
      `).all();

      const uploads = await env.DB.prepare(`
        SELECT id,title,filename
        FROM studio_uploads
        ORDER BY id DESC LIMIT 500
      `).all();

      const byAlbum = new Map();

      for (const t of tracks.results || []) {
        if (!byAlbum.has(t.album_id)) {
          byAlbum.set(t.album_id, []);
        }
        byAlbum.get(t.album_id).push(t);
      }

      return json({
        albums: (albums.results || []).map(a => ({
          ...a,
          tracks: byAlbum.get(a.id) || [],
          track_ids: (byAlbum.get(a.id) || []).map(t => t.upload_id)
        })),
        uploads: uploads.results || []
      });
    }

    if (method === 'POST' || method === 'PUT') {
      const body = await request.json().catch(() => null);
      let a;

      try {
        a = validate(body, method === 'PUT');
      } catch (e) {
        return json({ error: e.message }, 400);
      }

      await checkTracks(env, a.track_ids);

      if (method === 'POST') {
        const result = await env.DB.prepare(`
          INSERT INTO studio_albums
          (title,artist,release_type,description,cover_key,
           price_min_cents,published)
          VALUES (?,?,?,?,?,?,0)
        `).bind(
          a.title, a.artist, a.release_type, a.description,
          a.cover_key, a.price_min_cents
        ).run();

        const id = result.meta?.last_row_id;

        if (!positiveInt(id)) {
          throw Error('Album creation failed');
        }

        try {
          const statements = a.track_ids.map((trackId, index) =>
            env.DB.prepare(`
              INSERT INTO studio_album_tracks
              (album_id,upload_id,track_number)
              VALUES (?,?,?)
            `).bind(id, trackId, index + 1)
          );

          if (a.published) {
            statements.push(
              env.DB.prepare(
                'UPDATE studio_albums SET published=1 WHERE id=?'
              ).bind(id)
            );
          }

          if (statements.length) {
            await env.DB.batch(statements);
          }
        } catch (e) {
          await env.DB.prepare(
            'DELETE FROM studio_album_tracks WHERE album_id=?'
          ).bind(id).run().catch(() => {});

          await env.DB.prepare(
            'DELETE FROM studio_albums WHERE id=?'
          ).bind(id).run().catch(() => {});

          throw e;
        }

        return json({ ok: true, id }, 201);
      }

      const existing = await env.DB.prepare(
        'SELECT id FROM studio_albums WHERE id=?'
      ).bind(a.id).first();

      if (!existing) {
        return json({ error: 'Album not found' }, 404);
      }

      // Unpublish first to avoid showing a partially updated album.
      await env.DB.prepare(
        'UPDATE studio_albums SET published=0 WHERE id=?'
      ).bind(a.id).run();

      const statements = [
        env.DB.prepare(
          'DELETE FROM studio_album_tracks WHERE album_id=?'
        ).bind(a.id),

        ...a.track_ids.map((trackId, index) =>
          env.DB.prepare(`
            INSERT INTO studio_album_tracks
            (album_id,upload_id,track_number)
            VALUES (?,?,?)
          `).bind(a.id, trackId, index + 1)
        ),

        env.DB.prepare(`
          UPDATE studio_albums
          SET title=?,artist=?,release_type=?,description=?,
              cover_key=?,price_min_cents=?,published=?
          WHERE id=?
        `).bind(
          a.title, a.artist, a.release_type, a.description,
          a.cover_key, a.price_min_cents, a.published, a.id
        )
      ];

      await env.DB.batch(statements);

      return json({ ok: true, id: a.id });
    }

    if (method === 'DELETE') {
      const body = await request.json().catch(() => null);
      const id = Number(body?.id);

      if (!positiveInt(id)) {
        return json({ error: 'Invalid album ID' }, 400);
      }

      const purchases = await env.DB.prepare(`
        SELECT COUNT(*) AS count
        FROM studio_album_purchases
        WHERE album_id=?
      `).bind(id).first();

      if ((purchases?.count || 0) > 0) {
        return json({
          error: 'This album has purchases. Unpublish it instead of deleting it.'
        }, 409);
      }

      await env.DB.batch([
        env.DB.prepare(
          'DELETE FROM studio_album_tracks WHERE album_id=?'
        ).bind(id),
        env.DB.prepare(
          'DELETE FROM studio_albums WHERE id=?'
        ).bind(id)
      ]);

      return json({ ok: true });
    }

    return json({ error: 'Method not allowed' }, 405);

  } catch (e) {
    console.error('Album admin API error', e);

    return json({
      error: 'Album request failed. Check the database migration and server logs.'
    }, 500);
  }
}

export const onRequestGet = ({request,env}) =>
  handle(request,env,'GET');

export const onRequestPost = ({request,env}) =>
  handle(request,env,'POST');

export const onRequestPut = ({request,env}) =>
  handle(request,env,'PUT');

export const onRequestDelete = ({request,env}) =>
  handle(request,env,'DELETE');
