# OneTag — NFC Child Safety Wristband System

## Run it locally
```
npm install
```
Copy `.env.example` to `.env` and fill in a real `DATABASE_URL` (a local or
Render Postgres instance). Then:
```
node server.js
```
Open `http://localhost:3000` — on first run this creates your super_admin
account (username/password come from `SUPER_ADMIN_USERNAME` /
`SUPER_ADMIN_PASSWORD` env vars, or defaults to `ouqi` / `change-me-now`
with a loud warning in the logs).

## Pages
- `/` — tap-to-view: registration form (first tap) or the locked safety
  card (after registration). Has a visitor-facing MN/EN language toggle
  (Mandarin fully translated, just not shown yet — see index.html).
- `/admin-login.html` — login for you (super_admin) or a school admin
- `/admin-panel.html` — create schools, invite school admins (super_admin only)
- `/admin-setup.html` — where an invited admin sets their password via OTP
- `/dashboard.html` — scan + gate activity, auto-scoped to the logged-in
  admin's school (super_admin sees every school)
- `/parent-portal.html` — parent enters their phone → OTP to their email →
  views their own child's activity history

## Provisioning tags (before parents get wristbands)
```
curl -X POST YOUR_URL/api/admin/provision -H "Content-Type: application/json" -d "{\"count\":1800}"
```
Returns tag_ids OT-0001...OT-1800 — write these URLs to your NFC tags with
the ACR1552U using the separate `tag-writer` project (`prepare-tag.js`).

## What's built
- Multi-school system: real `schools` table (not free text), so a school
  admin's dashboard access is an actual enforced security boundary
- Admin accounts: invite by email → OTP-based password setup → login →
  12-hour sessions; super_admin sees everything, school_admin sees only
  their school
- Parent portal: phone lookup → OTP to registered email → view own child's
  history only, 30-minute session
- Registration → lock → OTP (email-only) → edit → re-lock cycle
- Gate logs: ACR1281U-C2 in/out, with a 30-minute minimum between a real
  "in" and "out" so kids playing with the tag don't spam false events
- Scan logs: every tap on the public page silently logs the SCANNER's
  phone GPS + timestamp — zero hardware/battery cost on the wristband
- Dashboard: filterable by school/class/name, merged IN/OUT rows per day
- Security: scrypt password hashing, parameterized SQL throughout, rate
  limiting on login/OTP endpoints, HTML-escaping on all rendered
  user-controlled data (tested against a real XSS payload)
- Real email sending via Gmail SMTP (falls back to console-logging if
  `EMAIL_USER`/`EMAIL_APP_PASSWORD` aren't set — useful for local dev)

## Database
PostgreSQL (not SQLite) — required because Render's filesystem resets on
every restart/redeploy. Schema auto-creates on first run via `initSchema()`
in `db.js`.

## Environment variables (see `.env.example`)
- `DATABASE_URL` — required
- `SUPER_ADMIN_USERNAME` / `SUPER_ADMIN_PASSWORD` — set before going live
- `ADMIN_KEY` — protects the site-language-switch endpoint
- `TAG_WRITE_KEY` — protects the tag-writer scripts' UID-binding endpoint
- `GATE_DEVICE_KEY` — protects the gate-reader check-in/out endpoint (enter
  this once into `gate-listener.html`'s on-screen setup — never hardcode
  it in that file, see "Known gaps" history below)
- `ALLOWED_ORIGINS` — optional, CORS allowlist (defaults to the production
  URL + localhost)
- `EMAIL_USER` / `EMAIL_APP_PASSWORD` — Gmail App Password for real OTP
  emails and for `scripts/backup.js` to email you backups
- `BACKUP_EMAIL_TO` — optional, where backups get emailed (defaults to
  `EMAIL_USER`)
- `TWILIO_ACCOUNT_SID` / `TWILIO_AUTH_TOKEN` / `TWILIO_PHONE_NUMBER` —
  optional, enables the real Call Guardian click-to-call relay

## Backups
`scripts/backup.js` exports every table that matters (schools, tags,
profiles, admins, staff, settings, gate/scan logs — deliberately excluding
short-lived session and OTP tables) to a single gzipped JSON file, and
emails it to you if `EMAIL_USER`/`EMAIL_APP_PASSWORD` are set.
```
npm run backup                          # writes to ./backups/, emails if configured
npm run restore -- backups/onetag-backup-2026-07-25.json.gz   # restores (safe upsert, never deletes)
```
Run it on a schedule with a **Render Cron Job** service (a separate,
cheap/free service type on Render — not the same as your web service)
pointed at the same `DATABASE_URL`, running `npm run backup` daily. If
you're instead on a paid Render Postgres plan, Render already does
automatic point-in-time-recovery backups for you — `npm run backup` is
still worth keeping as a second, off-platform copy.

## Security notes
This app handles children's names, photos, health info, and parents'
contact details, so a few things are worth understanding rather than just
trusting blindly:
- The public tap page (`/`) intentionally shows anyone who scans the
  wristband a *limited* view — name, photo, class, and a health summary
  (allergies/conditions/blood type) — with no login. It never shows parent
  contact info or raw emergency contacts to an anonymous visitor. The full
  record is only available to a logged-in admin, scoped to their own
  school (`GET /api/admin/profile/:tagId/full`).
- Editing an already-registered profile requires solving an OTP sent to
  the registered email; the resulting `editToken` is single-use, 15
  minutes, and required by the actual save request — not just the
  OTP-verify step. Just knowing a `tag_id` isn't enough to edit an
  existing profile.
- "Call Guardian" never sends the parent's number to the browser — the
  server looks it up and relays the call itself, so the visitor's phone
  only ever sees your Twilio number, and (if Twilio isn't configured) it
  tells the visitor plainly that calling isn't set up yet rather than
  silently failing.
- No formal legal review of Mongolia's data protection requirements for
  children's health data has been done — that's a legal, not technical,
  gap and worth getting real advice on before scaling up.
