# BIG SOLIS — Fan List Backend

This package turns the existing "Join La Familia" form into a working signup system.

## What it does

- Saves email addresses in Cloudflare D1
- Rejects invalid emails
- Prevents duplicate subscriptions
- Adds simple IP-based abuse protection
- Shows success/error messages directly on the page
- Includes an optional CSV export endpoint protected by an admin token

## 1. Upload these files to GitHub

Merge these into the root of the existing `elbigsolis-website` repository:

- `index.html`
- `functions/api/subscribe.js`
- `functions/api/export-subscribers.js`
- `migrations/0001_fan_list.sql`

Do not delete your existing `assets` folder.

## 2. Create the D1 database in Cloudflare

Cloudflare Dashboard:
**Storage & databases → D1 SQL Database → Create database**

Recommended name:
`big-solis-fans`

## 3. Run the SQL schema

Open the new D1 database → **Console**.

Copy/paste everything from:
`migrations/0001_fan_list.sql`

Run it once.

## 4. Bind the database to your Pages project

Cloudflare Dashboard:
**Workers & Pages → elbigsolis-website → Settings → Bindings**

Add a **D1 database binding**:

- Variable name: `DB`
- Database: `big-solis-fans`

Save it.

If Cloudflare asks which environments, add it to **Production** and **Preview**.

## 5. Optional: enable protected CSV export

In the same project's Settings, add an encrypted secret/environment variable:

- Name: `ADMIN_TOKEN`
- Value: create a long private random password

The export endpoint is:
`https://elbigsolis.com/api/export-subscribers`

It requires an Authorization header:
`Bearer YOUR_ADMIN_TOKEN`

Do not place the admin token in frontend code.

## 6. Redeploy

Once GitHub receives the files and the D1 binding exists, Cloudflare Pages will redeploy automatically.

Then test at:
https://elbigsolis.com

Enter a test email in "Join La Familia". You should see:

**You’re in. Welcome to La Familia.**

## Important

This stores subscribers, but it does not send newsletters yet.
Later, an email delivery service can use this list while the subscriber database remains yours.
