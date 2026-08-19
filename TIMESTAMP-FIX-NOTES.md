# Timestamp accuracy fixes (2nd pass, after checking the live repo)

You made the repo public temporarily so I could clone and check it
directly. Confirmed: `server.js`, `db.js`, `gate-listener.html`, and
`t.html` were all already byte-identical to what I'd sent — the earlier
`/api/gate-logs` fix was live. So "it shows the time when the phone reads
and opens" was a real, separate issue on top of that one. Found two
distinct causes, both fixed here.

## 1. Dashboard + parent portal frontends never looked at client_timestamp

`public/dashboard.html` (scan-log table) and `public/parent-portal.html`
(both gate and scan history) were reading `.timestamp` off each row —
receipt time — even though `/api/scan-logs` and `/api/parent/history`
already return `client_timestamp` too (they use `SELECT *`). No backend
change was needed; both files now use `r.client_timestamp || r.timestamp`
everywhere a time is displayed or a date-filter is computed, so the real
tap time shows whenever it's known, falling back to receipt time only for
rows that predate this feature.

Files changed: `public/dashboard.html`, `public/parent-portal.html`.

## 2. t.html and gate-listener.html stamped the time too late

Both pages captured `client_timestamp` via `new Date().toISOString()`
*after* waiting on other things first — `t.html` after the profile finished
loading (which can retry for several seconds on a bad connection) and
after up to a 4-second GPS wait; `gate-listener.html` after that same
4-second GPS wait. So the "real tap time" being sent to the server wasn't
actually the tap moment — it was whichever moment those waits happened to
finish. On a fast connection this is invisible (under a second of drift);
on a slow one, exactly the "shows the time when the phone reads and opens"
symptom you described.

Fixed by capturing the timestamp as the very first thing each script does
— before the profile fetch, before the GPS wait — and reusing that
captured value later instead of taking a fresh reading. This is still an
approximation (the literal physical tap happens an instant before the
browser even starts running the page), but it's the earliest moment
JavaScript can observe, which is as close as software can get.

Files changed: `public/t.html`, `public/gate-listener.html`.

## Verified

- All four files pass a JS syntax check.
- Headless test: simulated a 2.5s delayed profile-load response in
  `t.html` and confirmed the `client_timestamp` sent to `/api/scan/:tagId`
  was captured ~30ms after page load, not ~2.5s+ later.

## Deploy

Same as before — drop these four files into your `public/` folder,
commit, push, redeploy. No `server.js`/`db.js` changes this time; those
are unchanged from the last package. You can set the repo back to private
now — I'm done reading it.
