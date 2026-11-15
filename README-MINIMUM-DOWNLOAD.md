# $1 minimum download — BIG SOLIS STUDIO

All published songs remain free to stream. Downloads require a Stripe payment of at least $1. Fans may choose higher amounts.

**Server-side enforcement:** `/api/studio/download` now requires a verified paid Stripe Checkout session for EVERY download, including previously published songs whose database minimum was $0. Checkout enforces $1+ and each song’s higher configured minimum. Admin editing disallows minimums under $1. Public catalog displays at least $1.

No D1 migration is required. Existing song records with $0 stored are treated as $1 minimum.

Deploy the contents of this folder to your existing GitHub repository root, preserving directories. Set STRIPE_SECRET_KEY as a Cloudflare Pages secret to enable purchases. Test Stripe in test mode before accepting live payments. Keep your private R2 bucket private.

**Important:** These are source changes only; not deployed or live-tested. Free full-song streaming remains possible; browser playback can be captured, so paid downloads cannot guarantee that audio is impossible to save.
