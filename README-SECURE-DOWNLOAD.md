# BIG SOLIS STUDIO — Secure download update

Upload all contents of this directory to the existing GitHub repository on the main branch, preserving paths. Do not upload the enclosing folder. Cloudflare Pages redeploys automatically.

Changes: Stripe Checkout sessions include a store identifier; receipt verifies payment, track, amount and store identifier; receipt creates an HMAC-signed download grant valid for 15 minutes; download rechecks Stripe and the published track; fan page uses grant instead of raw session ID and removes the session from browser address bar. No new D1 migration or Cloudflare secret is needed. Existing ADMIN_TOKEN and STRIPE_SECRET_KEY remain unchanged.

IMPORTANT: The link can still be shared during its 15-minute validity. Strict one-time redemption requires a new database-backed redemption system. The streaming endpoint serves the full recording publicly for published tracks, so full-song audio can be captured independently of downloads. Do not publish a song if you need its audio to remain private.

TEST: Keep tracks unpublished while checking the deployment and configuration. For a Stripe Sandbox end-to-end checkout test, temporarily publish a track you are comfortable exposing publicly, make a test payment, confirm the receipt/download, then unpublish it. Do not switch to live Stripe keys until the end-to-end test passes.
