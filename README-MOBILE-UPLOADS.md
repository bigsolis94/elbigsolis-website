# BIG SOLIS STUDIO — Private Music Uploads

This release was built from the user's current GitHub ZIP backup, not from an older template.

## Cloudflare setup
- Production Pages project: elbigsolis-website
- R2 binding name: MUSIC_BUCKET, bucket: big-solis-music (private)
- D1 binding name: DB, database: big-solis-fans
- Existing secret: ADMIN_TOKEN

## Database
The `studio_uploads` table was already created successfully through the Cloudflare console. Do not need to rerun the migration. The included migration is for documentation/reproducibility.

## Deploy
Upload the CONTENTS of `elbigsolis-website-main` into the root of the GitHub `main` branch, retaining folder paths. GitHub should show changes to `admin/index.html`, and new files:
- admin/uploads/index.html
- functions/api/admin/uploads.js
- functions/api/admin/upload-audio.js
- migrations/0003_music_uploads.sql
- README-MOBILE-UPLOADS.md

Wait for Cloudflare Pages to deploy. Visit https://elbigsolis.com/admin/ and log in; click Open Music Uploader. Test with a small MP3.

## Limitations
- Private storage and authenticated listening only; does not publish tracks to the public website.
- 45 MB maximum per upload; no resume/multipart; mobile browser must stay open.
- Existing shared admin token is used; stronger user authentication is recommended before multi-artist use.
- Test in production after deployment; not live-tested here.
- For large masters, implement multipart/direct-to-R2 uploads with temporary scoped credentials and server-side validation.
