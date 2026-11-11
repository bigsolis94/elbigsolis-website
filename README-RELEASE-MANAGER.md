# BIG SOLIS Release Manager

## Setup (one-time)
1. Upload these updated repository files to GitHub (or upload the entire unzipped folder contents). Keep the same paths. Cloudflare Pages will redeploy from `main`.
2. In Cloudflare Dashboard > Workers & Pages > D1 > `big-solis-fans` > Console, run the contents of `migrations/0002_releases.sql` against the **production** database. The migration adds a new table and does not remove subscribers.
3. Confirm the existing Cloudflare Pages D1 binding `DB` points to that database and the secret `ADMIN_TOKEN` is still set.
4. Open `https://elbigsolis.com/admin/`, sign in with your existing token, scroll to **Release Manager**, and add your releases. Use a timezone-correct local date/time. Save.
5. The homepage will show upcoming releases with a countdown and will switch to streaming links once their date/time passes. The public catalog refreshes every five minutes while open; the API caches for up to 60 seconds.

## Important
- Add existing released songs to Release Manager before expecting the new dynamic catalog to show them. As soon as the database has published records, it replaces the static cards with those records.
- You can use existing `assets/` image paths by copying their full HTTPS URLs, e.g. `https://elbigsolis.com/assets/perdida.webp`.
- The system does **not** automatically discover new releases from Spotify or YouTube. It automates publishing **after you enter each release**. Platform syncing would be a separate second phase.
- Release time is converted from the admin browser's local timezone to UTC, so double-check your computer timezone before saving.
- Your existing subscriber dashboard, export and fan-signup endpoints are preserved.
- If the releases API is unavailable, the homepage keeps its original static content as a fallback.
- Do not enter your admin token in source code or commit credentials.
