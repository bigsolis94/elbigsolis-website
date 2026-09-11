# BIG SOLIS Admin Dashboard

This adds a private fan-list dashboard at:

https://elbigsolis.com/admin/

## What you get

- Total fan count
- Active subscriber count
- New subscribers this month
- Search by email/source
- CSV export
- Private admin-token authentication

## Files to upload to GitHub

Merge these into your existing repository:

- `admin/index.html`
- `functions/api/admin/subscribers.js`
- `functions/api/export-subscribers.js`

Keep your existing:
- `functions/api/subscribe.js`
- D1 `DB` binding
- `big-solis-fans` database

The package also includes the latest `index.html` and migration file for convenience.

## ONE Cloudflare setting you must add

Go to:

Workers & Pages → elbigsolis-website → Settings → Variables and Secrets

Add an encrypted secret:

- Name: `ADMIN_TOKEN`
- Value: make a long private password, for example 20+ random characters

DO NOT put this token in GitHub or in `index.html`.

After saving the secret, trigger one fresh deployment.

## Then use it

Open:

https://elbigsolis.com/admin/

Enter the same ADMIN_TOKEN.

## Security note

This is suitable for a simple private artist dashboard because the secret remains server-side and is only submitted when you log in. For stronger account-based access later, Cloudflare Access can be added in front of `/admin/*`.
Admin token enabled.
