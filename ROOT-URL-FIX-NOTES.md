# Fix: the main site link showed "No tag found" instead of the homepage

## What was wrong

`https://onetag-0b04.onrender.com` (the bare link, no `?tag=`) was serving
`public/index.html` — the wristband tap-to-view page — not
`public/home.html`, the marketing homepage with the scroll-story and
language toggle. With no `?tag=` in the URL, that page just showed:

> **No tag found**
> Scan a OneTag wristband to open its profile.

Nothing else in the app links to `home.html` either, so there was no way
to reach the actual homepage from the live site at all unless you already
knew the exact `/home.html` address. Anyone — a parent, a school, an
investor — visiting the plain link would land on what looks like a broken
page.

I checked the full codebase for other problems while I was in there
(every JS file, every page's inline script, every internal link and image
reference, and a live smoke test of every route with a stub database) —
this was the only real bug. Everything else checked out clean.

## The fix

One change, in `server.js`: the bare root URL now checks for `?tag=`.

- **No `?tag=`** (someone typing the plain domain, or clicking a link to
  it) → redirects to `/home.html`, the marketing homepage.
- **`?tag=OT-0001`** (a real wristband, a QR code, or any share link that
  includes the tag) → unchanged, still opens the tap-to-view safety card
  exactly as before.

This doesn't touch how the physical wristbands work — their NFC tags are
already encoded with the full `?tag=...` URL, so they're unaffected.

## Deploy

Just `server.js` this time — one file, no other changes needed, no new
dependencies.
