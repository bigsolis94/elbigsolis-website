# BIG SOLIS STUDIO Music Vault

## Install
1. Upload all files and folders from this ZIP to the **root** of your existing GitHub repository, preserving folder paths. Do not upload the ZIP itself.
2. Cloudflare D1 `big-solis-fans` → Console: execute `migrations/0004_music_store.sql` once. This adds a new table and preserves existing subscribers/releases/uploads.
3. Keep your existing Cloudflare Pages bindings `DB` (D1) and `MUSIC_BUCKET` (private R2). Do not expose the R2 bucket publicly.
4. Visit `https://elbigsolis.com/admin/store/`, enter your existing `ADMIN_TOKEN`, load tracks, and publish the songs you want to share. **Publishing makes the entire audio recording accessible to anyone on the Internet**, regardless of whether download price is zero or paid.
5. Visit `https://elbigsolis.com/music/` to preview the public catalog and stream the tracks.
6. For paid downloads: Cloudflare Pages → Settings → Variables and Secrets → add an **encrypted** secret named `STRIPE_SECRET_KEY` with your Stripe secret API key. Redeploy. Stripe account must be activated for live payments. Never put Stripe keys in GitHub or the page source.
7. $0 downloads work without Stripe. For paid downloads, visitors choose an amount >= $1, go through Stripe Checkout, and return to the Music Vault with a verified download link.

## Notes / limitations
- The original fan list, release manager, private uploader, and home page are retained unchanged. Music Vault is at `/music/` and its separate admin at `/admin/store/`.
- Existing uploaded WAV/MP3 masters are served as the full free stream once published. For high traffic, prepare separate optimized stream files to reduce bandwidth and avoid giving out the exact downloadable master through the player. **Streaming a full recording cannot prevent copying or recording.**
- Paid downloads verify Stripe Checkout session on each request. A buyer can reuse/share their receipt URL; add buyer accounts, single-use tokens, rate limiting, and an order database for stronger protection before scaling.
- A paid purchase is optional support plus a download, not a statutory royalty accounting system.
- Stripe payments have a $1 minimum in this implementation. $0 free downloads are available only for tracks with minimum price set to $0. A nonzero minimum means paid-only downloads, but full streaming remains free.
- No ISRC is needed for the private uploads, streaming, or direct downloads. Assign ISRCs if distributing recordings elsewhere and keep your ownership/split records.
- Before launch, test Stripe in test mode, then switch to a live secret key; confirm payments, refunds, and download permissions. Set your own sales/refund/license terms and ensure rights to beats, samples, and featured performances.
