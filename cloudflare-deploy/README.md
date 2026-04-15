# CNsourcer Cloudflare CMS Setup

This project now supports two modes:

- `Backend mode` (recommended): Cloudflare Pages Functions + D1. New clusters and merchants publish instantly from `admin.html`, and the public site reads live data from the database.
- `Fallback mode`: static JSON only. If the API is unavailable, the admin panel can still edit local data and export `site-data.json`.

## Files

- `index.html`: public search page
- `admin.html`: admin publishing dashboard
- `functions/`: Cloudflare Pages Functions API
- `db/schema.sql`: D1 schema
- `db/seed.sql`: initial D1 data generated from the current `site-data.json`
- `data/site-data.json`: static fallback data
- `cloudflare-deploy/`: Pages static output
- `wrangler.toml`: Cloudflare Pages + D1 config template

## Recommended Deployment

Use Cloudflare Pages with Git integration or `wrangler pages deploy`. Direct ZIP upload is not enough for the backend, because Pages Functions and D1 bindings must be deployed from the project root.

## One-Time Cloudflare Setup

1. Create a D1 database in Cloudflare, for example `cnsourcer-db`.
2. Put the returned database ID into `wrangler.toml`.
3. In the project root, run:

```bash
npx wrangler d1 execute cnsourcer-db --remote --file=db/schema.sql
npx wrangler d1 execute cnsourcer-db --remote --file=db/seed.sql
```

4. Add these environment variables in Cloudflare Pages or as Wrangler secrets:
   - `ADMIN_USERNAME=admin`
   - `ADMIN_PASSWORD_HASH=1cfc783c0ce1fb526e81035cde3021fd75f17007db6afd7115fd6cddbcde2c55`
   - `SESSION_SECRET=<your-own-random-secret>`

5. Deploy from the project root with Pages Functions enabled.

## How Publishing Works

1. Open `admin.html`.
2. Log in as the admin account.
3. Use the `Quick publish` forms at the top for new clusters and merchants.
4. Use the search + manager sections for editing existing records.
5. Click `Save cluster` or `Save merchant` to update a record.
6. The public site updates automatically because `index.html` reads from `/api/site-data`.

## Fallback Mode

If you open the project as static files without the backend:

- the site falls back to `data/site-data.json`
- the admin page switches to local edit mode
- export/import tools remain available

This makes it safe to preview locally before you finish the Cloudflare backend setup.
