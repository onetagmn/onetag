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
- `EMAIL_USER` / `EMAIL_APP_PASSWORD` — Gmail App Password for real OTP emails

## Known gaps before full production launch
- CORS is currently wide open (`Access-Control-Allow-Origin: *`) — tighten
  to your real domain once deployed
- No automated database backup strategy yet
- No formal legal review of Mongolia's data protection requirements for
  children's health data
- "Call Guardian" button currently just shows an alert — needs a real
  click-to-call relay (e.g. Twilio) so the parent's number is never sent
  to the browser
