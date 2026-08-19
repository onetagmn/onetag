# What's in this package

These are your real `server.js` and `db.js`, already patched — not
instructions this time, the actual files. Diff against your originals is
purely additive: new optional fields, one new endpoint, two new columns.
Nothing existing changes shape or behavior.

- **`server.js`** — `/api/gate/:tagId` and `/api/scan/:tagId` now accept an
  optional `client_timestamp` field; new `GET /api/gate/roster` endpoint
  for offline UID lookup.
- **`db.js`** — adds `gate_logs.client_timestamp` and
  `scan_logs.client_timestamp` (idempotent `ADD COLUMN IF NOT EXISTS`,
  safe to deploy — no migration step needed beyond a normal restart).
- **`public/gate-listener.html`** + **`public/gate-listener-sw.js`** — your
  gate reader page and its service worker, matching the filename your own
  `server.js` already refers to in its comments.
- **`public/t.html`** — the public "found this child" page. I don't have
  visibility into your actual `public/` folder (no repo access), and you
  weren't sure of its real filename either, so this ships as `t.html`. If
  a page already serves that role under a different name, check for a
  collision before deploying — either rename this file to match, or drop
  it in alongside and update whatever links to it (the NFC tags' NDEF URL,
  if that's how they're provisioned).

## Deploy steps

1. Replace `server.js` and `db.js` in your repo with these two.
2. Copy the three files under `public/` into your `public/` folder.
3. Push / redeploy on Render as usual — `initSchema()` runs the new
   `ALTER TABLE` statements automatically on boot.
4. Test one gate device and one phone tap in airplane mode before rolling
   out further.

## Not touched

`otp.js`, `home.html`, auth/session logic, rate limiting, CORS, the
wristband hardware itself, and the Three.js homepage scene (still pending
your review, separate from this).
