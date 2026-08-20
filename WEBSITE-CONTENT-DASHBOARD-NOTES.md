# Website content dashboard + Japanese language

What this adds:

1. A super-admin-only page (`admin-content.html`) to edit every text string
   on the public homepage in all three languages, hide/show whole sections
   or cards, and replace the 9 scrolling-story photos — all without
   touching code or redeploying.
2. Japanese as a third language on the homepage, alongside Mongolian and
   English — same toggle bar, same pattern the site already used (there was
   a half-built Chinese option in the code you weren't using; Japanese
   follows the identical pattern).

## Files changed / added

- `db.js` — new `site_content` table (one row per text string / story photo
  / hideable section), seeded once from `site-content-seed.js`.
- `site-content-seed.js` — **new file.** The original wording (MN/EN/JP) for
  every text key, the current URL for each of the 9 story photos, and the
  list of sections/cards that can be hidden. Only used to fill in the table
  the first time it's empty — editing a value later from the dashboard is
  never overwritten by this file.
- `server.js` — new routes:
  - `GET /api/site-content` — public, home.html fetches this on every load.
  - `GET /api/admin/site-content`, `PUT .../text/:key`, `PUT .../block/:key`,
    `POST .../image/:key` — all require a super-admin login.
- `public/home.html` — fetches the content above and merges it in before
  rendering; added Japanese; added `data-block` markers on hideable
  sections/cards. Falls back to the original hardcoded wording if the
  fetch fails for any reason (offline, slow, feature not deployed yet) —
  it can never make the page blank or broken.
- `public/admin-content.html` — **new file.** The dashboard page itself.
- `public/dashboard.html`, `public/admin-panel.html` — added a "Website
  content" link, visible only to super-admins (same pattern as the
  existing "Manage schools & admins" link).
- `package.json` — added `multer` (handles the photo upload) and
  `cloudinary` (stores the uploaded photo).

## One-time setup: photo uploads need Cloudinary

Render's own disk resets on every deploy, so a plain "upload a file"
button would lose the photo the next time you push code. Photo uploads
go to Cloudinary instead — a real, persistent, CDN-backed image host with
a free tier that's more than enough for 9 photos:

1. Create a free account at cloudinary.com (no credit card needed for the
   free tier).
2. On your Cloudinary dashboard's home page, there's an "API Environment
   variable" box showing your Cloud name, API Key, and API Secret.
3. In Render → your onetag web service → Environment, add three variables:
   - `CLOUDINARY_CLOUD_NAME`
   - `CLOUDINARY_API_KEY`
   - `CLOUDINARY_API_SECRET`
4. Redeploy. That's it — no code changes needed.

Until those three are set, everything else works normally (text editing,
hiding sections, the Japanese toggle) — only the "Upload new photo" button
will show a clear "not configured yet" message instead of failing silently.

## Deploy

Everything in this package: `server.js`, `db.js`, `site-content-seed.js`,
`package.json`, and the four files under `public/`. Drop them into your
repo (this replaces the same files, plus adds the two new ones), commit,
push. Render will run `npm install` automatically and pick up the two new
dependencies.

The first time the app boots after this deploy, it seeds ~150 rows into
the new `site_content` table automatically — no manual database step
needed.

## Using the dashboard

Log in as a super-admin, then either use the new "Website content" link
on the main dashboard or go to `/admin-content.html` directly.

- **Text tab** — search by key or by what the text actually says, edit
  any of the three languages, click Save on that card. Each string saves
  independently.
- **Story photos tab** — the 9 photos in the scrolling hero, in order.
  Minimum 1600×900px landscape, JPG, under ~500KB — see the in-page size
  guide for why (they fill the whole screen and get cropped to fit both
  wide desktop and tall phone screens).
- **Show / hide sections tab** — flip any switch off to hide that section,
  feature card, FAQ item, or benefits tab from the live site instantly.
  The hero story and the Contact section aren't included here on purpose —
  hiding either would break the page's core purpose.

## Small content fix made along the way

`faq_5_a` ("Which languages are supported?") and the "Durable & bilingual"
feature card both said "Mongolian and English" — now that Japanese is
shipping, that became inaccurate the moment this deploys, so both were
updated to mention all three languages (in MN/EN/JP). Everything else is
unchanged wording.
