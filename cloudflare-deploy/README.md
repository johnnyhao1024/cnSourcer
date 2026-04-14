# CNsourcer Static Site

Cloudflare-ready static website with:

- `index.html`: public supplier and industrial-cluster search page
- `admin.html`: browser-based admin panel for editing data
- `data/site-data.json`: the single source of truth for clusters and merchants

## Upload To Cloudflare Pages

Upload the whole folder, keeping this structure:

- `index.html`
- `admin.html`
- `assets/css/site.css`
- `assets/js/site-app.js`
- `assets/js/admin-app.js`
- `data/site-data.json`

## How To Edit Later

1. Open `admin.html` in the deployed site or locally.
2. Add, edit, or delete clusters and merchants.
3. Click `Export site-data.json`.
4. Replace `/data/site-data.json` with the exported file.
5. Re-upload the project to Cloudflare Pages.

## Notes

- This is a pure static project with no backend.
- Admin changes are stored only in the browser until you export JSON.
- Merchant records must reference an existing cluster ID.
