# Updated logo — bigger, single-color, colors cycling

This replaces the previous logo push (the navy+gold pin). If you already
pushed that one, this new push overwrites it — same files, new content.

## What changed

- **The exact image you sent** is now the site logo — I didn't redraw
  anything. Your file had a printed-in checkerboard pattern instead of
  real transparency (common when an AI image tool's preview is
  downloaded directly), so I rebuilt it as a proper transparent PNG from
  your same artwork — same shape, same teal color, just a real
  see-through background instead of a checkerboard.
- **Bigger**: the header logo went from 28px to 42px.
- **Colors change continuously, the whole mark**: not just the signal
  arcs this time — the entire icon smoothly cycles through the color
  wheel (teal → blue → purple → red → orange → green → back to teal) on
  a 6-second loop, forever, for as long as someone's on the page.
- Favicon (browser tab icon) stays a still frame in the original teal —
  same reason as before, browsers don't animate tab icons.

## Files in this folder

- `public/home.html` — logo swapped to the new image, sized up, color-cycle animation added
- `public/assets/logo-mark.png` — your logo, transparency fixed
- `public/assets/favicon-32.png`, `favicon-16.png`, `apple-touch-icon.png` — regenerated from the same image
- The other 9 HTML files are unchanged from the last push (still just carrying the favicon tag) — included so the folder is complete to copy over

## Step by step (same as before)

1. Open your local `onetag` folder (the one GitHub Desktop tracks).
2. Copy everything from this folder into it, same paths, overwrite when asked.
3. GitHub Desktop → write a commit message, e.g. "Update logo: single-color, larger, continuous color-cycle" → **Commit to main**.
4. **Push origin**.
5. Render redeploys in a minute or two — then hard-refresh **onetagmn.com** (Ctrl/Cmd+Shift+R) so the browser drops the cached favicon.

## How the color-cycle works (for reference)

It's a CSS filter animation on the logo image — `hue-rotate()` sweeping
0° to 360° over 6 seconds, on a loop. It's applied to your image file
directly, so no vector recreation was needed to make this work.
