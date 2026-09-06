# New logo — what changed and how to push it

## What's in this folder

Only the files that changed, in the same `public/` layout as your repo:

- `public/home.html` — the header logo is now the new pin-mark icon (animated: the gold signal pulses continuously), plus a favicon tag was added
- `public/assets/logo-mark.svg`, `favicon-32.png`, `favicon-16.png`, `apple-touch-icon.png` — the new icon files
- `public/admin-content.html`, `admin-login.html`, `admin-panel.html`, `admin-setup.html`, `dashboard.html`, `gate-listener.html`, `index.html`, `parent-portal.html`, `t.html` — each got the same 3-line favicon addition only, nothing else touched

Nothing in `server.js`, `db.js`, or any other backend file changed — this is front-end only, safe to push on its own.

## Step by step (GitHub Desktop, same as your last few pushes)

1. Open your local `onetag` folder (the one GitHub Desktop is already tracking).
2. Copy every file from this delivery folder into that local folder, **matching the same path** — e.g. this `public/home.html` overwrites your local `public/home.html`. When your file manager asks to replace the existing files, say yes.
3. Switch to GitHub Desktop. It'll list the changed/added files on the left (the 10 HTML files + the 4 new files in `public/assets/`).
4. Bottom-left, write a commit message, e.g. "Add new pin logo with animated signal + site favicon".
5. Click **Commit to main**.
6. Click **Push origin** (top bar).
7. Render redeploys automatically a minute or two after the push — refresh **onetagmn.com** after that (a hard refresh — Ctrl/Cmd+Shift+R — helps if your browser cached the old favicon).

## What to expect after it's live

- The browser tab icon (favicon) becomes the new pin mark, on every page.
- The site header logo (top-left, next to "Home / How it works / ...") becomes the new pin mark with "OneTag" next to it, and the gold signal arcs pulse continuously — this only animates on `home.html` itself; the favicon stays a still image everywhere (browsers don't animate tab icons — see note below).
- Nothing else on the site changes — no layout, no other page content, no backend behavior.

## One real limitation, so it's not a surprise later

Browsers throttle or refuse to animate favicons to save battery, so the tab icon will stay a static frame of the pin mark — only the in-page header logo pulses. This is normal and how essentially every real site handles it; no fix needed on your end.
